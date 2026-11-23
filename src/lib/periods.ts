import { addDays, addMonths, fmtDate } from "@/lib/format";
import type { createClient } from "@/lib/supabase/server";

/**
 * Finanzas agrupadas por nómina, no por mes natural.
 * El periodo "YYYY-MM" empieza el día en que se cobró la nómina de ese mes
 * (ingreso de categoría "Nómina" a partir del día 20) y termina el día antes
 * de la nómina siguiente. Si no hay nómina registrada se usa el día 26.
 */
export const PAYDAY_FALLBACK = 26;
const PAYDAY_MIN_DAY = 20;

export type Period = { ym: string; start: string; end: string }; // end exclusivo

const isNomina = (c: string | null) =>
  !!c && c.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase() === "nomina";

/** Fechas (YYYY-MM-DD) de las nóminas entre dos meses (ambos incluidos). */
export async function loadPaydays(supabase: Awaited<ReturnType<typeof createClient>>, fromYm: string, toYm: string) {
  const res = await supabase.from("transactions").select("date,category").eq("kind", "ingreso")
    .gte("date", `${fromYm}-01`).lt("date", `${addMonths(toYm, 1)}-01`);
  const days = ((res.data ?? []) as { date: string; category: string | null }[])
    .filter((t) => isNomina(t.category) && Number(t.date.slice(8, 10)) >= PAYDAY_MIN_DAY)
    .map((t) => t.date.slice(0, 10));
  return { paydays: [...new Set(days)].sort(), res };
}

/** Día en que empieza el periodo de nómina del mes `ym`. */
export function periodStart(ym: string, paydays: string[], today: string): string {
  const paid = paydays.find((d) => d.startsWith(ym));
  if (paid) return paid;
  const fallback = `${ym}-${PAYDAY_FALLBACK}`;
  // Ya es día 26 o más de este mes y todavía no ha llegado la nómina: el periodo aún no ha empezado.
  if (ym === today.slice(0, 7) && fallback <= today) return addDays(today, 1);
  return fallback;
}

export function period(ym: string, paydays: string[], today: string): Period {
  return { ym, start: periodStart(ym, paydays, today), end: periodStart(addMonths(ym, 1), paydays, today) };
}

/** Periodo en el que cae hoy. */
export function currentPeriodYm(paydays: string[], today: string) {
  const ym = today.slice(0, 7);
  return periodStart(ym, paydays, today) <= today ? ym : addMonths(ym, -1);
}

/** "28 nov – 27 dic" */
export function periodLabel(p: Period) {
  const f = (d: string) => fmtDate(d, { day: "numeric", month: "short" }).replace(".", "");
  return `${f(p.start)} – ${f(addDays(p.end, -1))}`;
}

export function periodDays(p: Period) {
  return Math.round((Date.parse(p.end) - Date.parse(p.start)) / 86_400_000);
}
