import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TZ, addMinutesLocal } from "./format";
import type { AgendaEvent } from "./types";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const API = "https://www.googleapis.com/calendar/v3";
const SCOPE = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly";

export class GoogleError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export function googleConfigured() {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}

export function redirectUri(origin: string) {
  return `${origin}/api/google/callback`;
}

export function authUrl(origin: string, state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent", // fuerza a Google a devolver refresh_token
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      ...body,
    }),
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) throw new GoogleError(json.error_description || json.error || "Error de Google", res.status);
  return json as { access_token: string; refresh_token?: string; expires_in: number };
}

export function exchangeCode(code: string, origin: string) {
  return tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri(origin) });
}

export async function revokeToken(token: string) {
  await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => {});
}

async function api<T>(accessToken: string, path: string, init: RequestInit = {}): Promise<T | null> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  if (res.status === 204) return null;
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new GoogleError(json.error?.message || `Google Calendar respondió ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}

export async function primaryCalendarId(accessToken: string) {
  const cal = await api<{ id: string }>(accessToken, "/calendars/primary");
  return cal!.id; // el id del calendario principal es el email de la cuenta
}

/** Cliente autenticado contra Google para el usuario actual, o null si no ha conectado su cuenta. */
export async function googleSession(supabase: SupabaseClient) {
  if (!googleConfigured()) return null;
  const { data } = await supabase.from("google_accounts").select("refresh_token, calendar_id").maybeSingle();
  if (!data) return null;
  const { access_token } = await tokenRequest({ grant_type: "refresh_token", refresh_token: data.refresh_token });
  return { accessToken: access_token, calendarId: data.calendar_id as string };
}

type Session = NonNullable<Awaited<ReturnType<typeof googleSession>>>;

function toGoogleEvent(e: AgendaEvent) {
  const start = e.starts_at.replace(" ", "T").slice(0, 19).padEnd(19, ":00").slice(0, 19);
  const end = e.ends_at && e.ends_at > e.starts_at ? e.ends_at.replace(" ", "T").slice(0, 19) : addMinutesLocal(start, 60);
  const description = [
    e.description,
    e.attendees && `Asistentes: ${e.attendees}`,
    e.notes && `Notas:\n${e.notes}`,
  ].filter(Boolean).join("\n\n");

  const r = e.reminder_minutes;
  return {
    summary: e.title,
    location: e.location ?? undefined,
    description: description || undefined,
    start: { dateTime: start, timeZone: TZ },
    end: { dateTime: end, timeZone: TZ },
    reminders: r === null || r === undefined
      ? { useDefault: true }
      : { useDefault: false, overrides: r < 0 ? [] : [{ method: "popup", minutes: r }] },
    extendedProperties: { private: { agendaId: e.id } },
  };
}

/** Crea o actualiza el evento en Google. Devuelve el id del evento en Google. */
export async function upsertGoogleEvent(g: Session, e: AgendaEvent): Promise<string> {
  const cal = encodeURIComponent(g.calendarId);
  const body = JSON.stringify(toGoogleEvent(e));
  if (e.google_event_id) {
    try {
      await api(g.accessToken, `/calendars/${cal}/events/${encodeURIComponent(e.google_event_id)}`, { method: "PUT", body });
      return e.google_event_id;
    } catch (err) {
      // Si lo borraste en Google, se vuelve a crear.
      if (!(err instanceof GoogleError && (err.status === 404 || err.status === 410))) throw err;
    }
  }
  const created = await api<{ id: string }>(g.accessToken, `/calendars/${cal}/events`, { method: "POST", body });
  return created!.id;
}

export async function deleteGoogleEvent(g: Session, googleEventId: string) {
  try {
    await api(g.accessToken, `/calendars/${encodeURIComponent(g.calendarId)}/events/${encodeURIComponent(googleEventId)}`, { method: "DELETE" });
  } catch (err) {
    if (!(err instanceof GoogleError && (err.status === 404 || err.status === 410))) throw err;
  }
}
