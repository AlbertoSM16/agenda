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
  const t = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(asUTC(`${ym}-01`));
  return t.charAt(0).toUpperCase() + t.slice(1);
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

// ---------- Entrenamientos ----------

/** Lunes (YYYY-MM-DD) de la semana de una fecha. */
export function mondayOf(iso: string) {
  const d = asUTC(iso.slice(0, 10));
  return addDays(iso.slice(0, 10), -((d.getUTCDay() + 6) % 7));
}

/** "1 h 05 min" / "45 min". */
export function fmtDuration(s: number | null | undefined) {
  if (!s) return "—";
  const t = Math.round(Number(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}

/** "1:05:12" / "4:35". */
export function fmtClock(s: number | null | undefined) {
  if (s === null || s === undefined || !Number.isFinite(Number(s))) return "—";
  const t = Math.round(Number(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Ritmo a partir de m/s: por km (carrera) o por 100 m (natación). */
export function fmtPace(mps: number | null | undefined, perMeters = 1000) {
  if (!mps || Number(mps) <= 0) return "—";
  return fmtClock(perMeters / Number(mps));
}

export function fmtKmh(mps: number | null | undefined) {
  if (!mps) return "—";
  return `${fmtNum(Number(mps) * 3.6, 1)} km/h`;
}

export function fmtKm(m: number | null | undefined, digits = 1) {
  if (!m) return "—";
  return `${fmtNum(Number(m) / 1000, digits)} km`;
}

export function fmtNum(n: number | null | undefined, digits = 0) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
  return Number(n).toLocaleString("es-ES", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

/** Fecha y hora local actual "YYYY-MM-DDTHH:mm" en la zona horaria del usuario. */
export function nowLocalISO() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Día de la semana 0 = lunes … 6 = domingo. */
export function weekdayOf(iso: string) {
  return (asUTC(iso.slice(0, 10)).getUTCDay() + 6) % 7;
}
