import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt, encrypt } from "./crypto";
import { API_UA, GarminError, exchangeOAuth2, type GarminTokens } from "./sso";

const API = "https://connectapi.garmin.com";

async function rawGet(tokens: GarminTokens, path: string) {
  return fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${tokens.oauth2.access_token}`, "User-Agent": API_UA },
    cache: "no-store",
  });
}

/** Nombre visible del perfil de Garmin (para mostrar "Conectado como…"). */
export async function profileName(tokens: GarminTokens): Promise<string | null> {
  try {
    const res = await rawGet(tokens, "/userprofile-service/socialProfile");
    if (!res.ok) return null;
    const p = await res.json();
    return p.fullName || p.displayName || p.userName || null;
  } catch {
    return null;
  }
}

/** Valida y completa tokens pegados a mano (plan B). Acepta JSON o JSON en base64. */
export async function parsePastedTokens(text: string): Promise<GarminTokens> {
  let obj: unknown;
  try {
    const t = text.trim();
    obj = JSON.parse(t.startsWith("{") ? t : Buffer.from(t, "base64").toString("utf8"));
  } catch {
    throw new GarminError("El texto pegado no son tokens válidos.");
  }
  const o = obj as Partial<GarminTokens>;
  if (!o?.oauth1?.oauth_token || !o.oauth1.oauth_token_secret) throw new GarminError("Faltan los tokens OAuth1.");
  const oauth2 = o.oauth2?.access_token && o.oauth2.expires_at > Date.now() / 1000 + 60 ? o.oauth2 : await exchangeOAuth2(o.oauth1);
  return { oauth1: o.oauth1, oauth2 };
}

/** Cliente de la API de Garmin para el usuario actual, o null si no hay cuenta conectada. */
export async function garminClient(supabase: SupabaseClient) {
  const { data: acc, error } = await supabase.from("garmin_accounts").select("user_id, tokens_enc").maybeSingle();
  if (error) throw new Error(error.message);
  if (!acc?.tokens_enc) return null;

  let tokens = JSON.parse(decrypt(acc.tokens_enc)) as GarminTokens;

  async function refresh() {
    tokens = { ...tokens, oauth2: await exchangeOAuth2(tokens.oauth1) };
    await supabase.from("garmin_accounts").update({ tokens_enc: encrypt(JSON.stringify(tokens)) }).eq("user_id", acc!.user_id);
  }

  async function get<T>(path: string): Promise<T | null> {
    if (tokens.oauth2.expires_at - 60 < Date.now() / 1000) await refresh();
    let res = await rawGet(tokens, path);
    if (res.status === 401) {
      await refresh();
      res = await rawGet(tokens, path);
    }
    if (res.status === 204 || res.status === 404) return null;
    if (res.status === 429) throw new GarminError("Garmin está limitando las peticiones (429). Prueba más tarde.", "rate_limited");
    if (!res.ok) throw new GarminError(`La API de Garmin respondió ${res.status} en ${path.split("?")[0]}`);
    return (await res.json()) as T;
  }

  return { userId: acc.user_id as string, get };
}
