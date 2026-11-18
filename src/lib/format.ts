export const TZ = process.env.NEXT_PUBLIC_TZ || "Europe/Madrid";

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria del usuario. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

/** Convierte "YYYY-MM-DD" u "YYYY-MM-DDTHH:mm[:ss]" (hora local sin zona) a un Date en UTC para formatear sin desfases. */
export function asUTC(s: string): Date {
  const base = s.replace(" ", "T").slice(0, 19);
  return new Date(base.length <= 10 ? `${base}T00:00:00Z` : `${base}Z`);
}

export function addDays(iso: string, n: number): string {
  const d = asUTC(iso.slice(0, 10));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function fmtDate(s: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat("es-ES", { ...opts, timeZone: "UTC" }).format(asUTC(s));
}

export function fmtTime(s: string) {
  return s.replace(" ", "T").slice(11, 16);
}

export function monthLabel(ym: string) {
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(asUTC(`${ym}-01`));
}

export function eur(n: number | string | null | undefined) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(n ?? 0));
}

/** Valor para <input type="datetime-local">. */
export function toInputDT(s: string | null | undefined) {
  return s ? s.replace(" ", "T").slice(0, 16) : "";
}

export function isYearMonth(s: string | undefined): s is string {
  return !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

/** Suma minutos a una fecha-hora local sin zona ("YYYY-MM-DDTHH:mm[:ss]") y la devuelve como "YYYY-MM-DDTHH:mm:ss". */
export function addMinutesLocal(s: string, minutes: number) {
  const d = asUTC(s);
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  return d.toISOString().slice(0, 19);
}
