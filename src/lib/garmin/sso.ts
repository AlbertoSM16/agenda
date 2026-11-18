// Login en Garmin Connect (API NO oficial). Reproduce el flujo de la librería "garth":
// SSO web → ticket → token OAuth1 (dura ~1 año) → token OAuth2 (se renueva con el OAuth1).
// Sin dependencias: solo fetch y node:crypto, para poder usarlo también desde scripts/garmin-login.ts.
import { createHmac, randomBytes } from "node:crypto";

export type OAuth1Token = { oauth_token: string; oauth_token_secret: string; mfa_token?: string };
export type OAuth2Token = { access_token: string; expires_in: number; expires_at: number; [k: string]: unknown };
export type GarminTokens = { oauth1: OAuth1Token; oauth2: OAuth2Token };
export type MfaState = { cookies: Record<string, string>; csrf: string; referer: string };
export type LoginResult = { status: "ok"; tokens: GarminTokens } | { status: "mfa"; state: MfaState };

export class GarminError extends Error {
  code: string;
  constructor(message: string, code = "error") {
    super(message);
    this.code = code;
  }
}

const SSO = "https://sso.garmin.com/sso";
const SSO_EMBED = `${SSO}/embed`;
const OAUTH = "https://connectapi.garmin.com/oauth-service/oauth";
const CONSUMER_URL = "https://thegarth.s3.amazonaws.com/oauth_consumer.json";
export const API_UA = "GCM-iOS-5.7.2.1";
const OAUTH_UA = "com.garmin.android.apps.connectmobile";

const EMBED_PARAMS = { id: "gauth-widget", embedWidget: "true", gauthHost: SSO };
const SIGNIN_PARAMS = {
  ...EMBED_PARAMS,
  gauthHost: SSO_EMBED,
  service: SSO_EMBED,
  source: SSO_EMBED,
  redirectAfterAccountLoginUrl: SSO_EMBED,
  redirectAfterAccountCreationUrl: SSO_EMBED,
};

const qs = (o: Record<string, string>) => new URLSearchParams(o).toString();

// ---------- Cookies (tarro mínimo: todas las peticiones SSO van al mismo dominio) ----------

class Jar {
  cookies: Record<string, string>;
  constructor(init: Record<string, string> = {}) {
    this.cookies = { ...init };
  }
  header() {
    return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join("; ");
  }
  store(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const pair = c.split(";")[0];
      const i = pair.indexOf("=");
      if (i <= 0) continue;
      const name = pair.slice(0, i).trim();
      const value = pair.slice(i + 1).trim();
      if (value === "" || /max-age=0\b|expires=thu, 01[- ]jan[- ]1970/i.test(c)) delete this.cookies[name];
      else this.cookies[name] = value;
    }
  }
}

async function ssoFetch(jar: Jar, url: string, opts: { method?: string; body?: string; referer?: string } = {}) {
  let current = url;
  let method = opts.method ?? "GET";
  let body = opts.body;
  for (let hop = 0; hop < 10; hop++) {
    const headers: Record<string, string> = { "User-Agent": API_UA, Cookie: jar.header() };
    if (opts.referer) headers.Referer = opts.referer;
    if (body) headers["Content-Type"] = "application/x-www-form-urlencoded";
    const res = await fetch(current, { method, body, headers, redirect: "manual", cache: "no-store" });
    jar.store(res);
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current).toString();
      method = "GET";
      body = undefined;
      continue;
    }
    checkStatus(res.status);
    return { text: await res.text(), url: current };
  }
  throw new GarminError("Demasiadas redirecciones en el login de Garmin");
}

function checkStatus(status: number) {
  if (status === 429) {
    throw new GarminError(
      "Garmin ha bloqueado temporalmente el inicio de sesión (429). Espera un rato o usa el plan B: npm run garmin:login en tu ordenador.",
      "rate_limited",
    );
  }
  if (status === 403) {
    throw new GarminError(
      "Garmin ha rechazado la conexión desde este servidor (403). Usa el plan B: npm run garmin:login en tu ordenador.",
      "blocked",
    );
  }
  if (status >= 400) throw new GarminError(`Garmin respondió con un error ${status}`);
}

const csrfOf = (html: string) => {
  const m = html.match(/name="_csrf"\s+value="(.+?)"/);
  if (!m) throw new GarminError("No se encontró el token CSRF en la página de login de Garmin (¿ha cambiado el login?)");
  return m[1];
};
const titleOf = (html: string) => html.match(/<title>(.+?)<\/title>/)?.[1]?.trim() ?? "";

// ---------- Login ----------

export async function login(email: string, password: string): Promise<LoginResult> {
  const jar = new Jar();
  const embedUrl = `${SSO_EMBED}?${qs(EMBED_PARAMS)}`;
  const signinUrl = `${SSO}/signin?${qs(SIGNIN_PARAMS)}`;

  await ssoFetch(jar, embedUrl);
  const page = await ssoFetch(jar, signinUrl, { referer: embedUrl });
  const res = await ssoFetch(jar, signinUrl, {
    method: "POST",
    referer: signinUrl,
    body: qs({ username: email, password, embed: "true", _csrf: csrfOf(page.text) }),
  });

  if (titleOf(res.text).includes("MFA")) {
    return { status: "mfa", state: { cookies: jar.cookies, csrf: csrfOf(res.text), referer: res.url } };
  }
  return { status: "ok", tokens: await finishLogin(res.text) };
}

export async function resumeMfa(state: MfaState, code: string): Promise<GarminTokens> {
  const jar = new Jar(state.cookies);
  const res = await ssoFetch(jar, `${SSO}/verifyMFA/loginEnterMfaCode?${qs(SIGNIN_PARAMS)}`, {
    method: "POST",
    referer: state.referer,
    body: qs({ "mfa-code": code.trim(), embed: "true", _csrf: state.csrf, fromPage: "setupEnterMfaCode" }),
  });
  return finishLogin(res.text);
}

async function finishLogin(html: string): Promise<GarminTokens> {
  const title = titleOf(html);
  if (title !== "Success") {
    if (title.includes("MFA")) throw new GarminError("Código de verificación incorrecto o caducado.", "mfa_invalid");
    if (/locked/i.test(html)) throw new GarminError("Garmin ha bloqueado la cuenta temporalmente por demasiados intentos.", "locked");
    throw new GarminError("Email o contraseña de Garmin incorrectos.", "bad_credentials");
  }
  const ticket = html.match(/embed\?ticket=([^"]+)"/)?.[1];
  if (!ticket) throw new GarminError("Garmin no devolvió el ticket de sesión");
  const oauth1 = await getOAuth1(ticket);
  return { oauth1, oauth2: await exchangeOAuth2(oauth1) };
}

// ---------- OAuth1 / OAuth2 ----------

type Consumer = { consumer_key: string; consumer_secret: string };
let consumerCache: Consumer | null = null;

async function getConsumer(): Promise<Consumer> {
  if (consumerCache) return consumerCache;
  const res = await fetch(CONSUMER_URL, { cache: "no-store" });
  if (!res.ok) throw new GarminError("No se pudo obtener la clave OAuth pública de Garmin");
  consumerCache = (await res.json()) as Consumer;
  return consumerCache;
}

const pct = (s: string) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

/** Cabecera Authorization OAuth 1.0a (HMAC-SHA1). `extra` = parámetros del cuerpo form-urlencoded. */
export function oauth1Header(
  method: string,
  url: string,
  consumer: Consumer,
  token?: { key: string; secret: string },
  extra: Record<string, string> = {},
  fixed?: { nonce: string; timestamp: string },
) {
  const u = new URL(url);
  const oauth: Record<string, string> = {
    oauth_consumer_key: consumer.consumer_key,
    oauth_nonce: fixed?.nonce ?? randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: fixed?.timestamp ?? String(Math.floor(Date.now() / 1000)),
    oauth_version: "1.0",
  };
  if (token) oauth.oauth_token = token.key;

  const params = [...u.searchParams.entries(), ...Object.entries(extra), ...Object.entries(oauth)]
    .map(([k, v]) => [pct(k), pct(v)] as const)
    .sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const base = [method.toUpperCase(), pct(`${u.origin}${u.pathname}`), pct(params)].join("&");
  const signingKey = `${pct(consumer.consumer_secret)}&${pct(token?.secret ?? "")}`;
  oauth.oauth_signature = createHmac("sha1", signingKey).update(base).digest("base64");

  return "OAuth " + Object.entries(oauth).map(([k, v]) => `${pct(k)}="${pct(v)}"`).join(", ");
}

async function getOAuth1(ticket: string): Promise<OAuth1Token> {
  const consumer = await getConsumer();
  const url = `${OAUTH}/preauthorized?${qs({ ticket, "login-url": SSO_EMBED, "accepts-mfa-tokens": "true" })}`;
  const res = await fetch(url, {
    headers: { "User-Agent": OAUTH_UA, Authorization: oauth1Header("GET", url, consumer) },
    cache: "no-store",
  });
  checkStatus(res.status);
  const p = new URLSearchParams(await res.text());
  const oauth_token = p.get("oauth_token");
  const oauth_token_secret = p.get("oauth_token_secret");
  if (!oauth_token || !oauth_token_secret) throw new GarminError("Garmin no devolvió el token OAuth1");
  return { oauth_token, oauth_token_secret, ...(p.get("mfa_token") ? { mfa_token: p.get("mfa_token")! } : {}) };
}

/** Obtiene un OAuth2 nuevo a partir del OAuth1 (sirve también para "renovar"). */
export async function exchangeOAuth2(oauth1: OAuth1Token): Promise<OAuth2Token> {
  const consumer = await getConsumer();
  const url = `${OAUTH}/exchange/user/2.0`;
  const body: Record<string, string> = oauth1.mfa_token ? { mfa_token: oauth1.mfa_token } : {};
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "User-Agent": OAUTH_UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: oauth1Header("POST", url, consumer, { key: oauth1.oauth_token, secret: oauth1.oauth_token_secret }, body),
    },
    body: qs(body),
    cache: "no-store",
  });
  if (res.status === 401) {
    throw new GarminError("La sesión de Garmin ha caducado. Vuelve a conectar tu cuenta.", "expired");
  }
  checkStatus(res.status);
  const json = (await res.json()) as OAuth2Token;
  if (!json.access_token) throw new GarminError("Garmin no devolvió el token OAuth2");
  return { ...json, expires_at: Math.floor(Date.now() / 1000) + Number(json.expires_in ?? 3600) };
}
