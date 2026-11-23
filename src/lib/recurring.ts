import "server-only";
import { addMonths } from "@/lib/format";
import type { createClient } from "@/lib/supabase/server";
import type { RecurringTransaction } from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Día de cobro dentro del mes (el 31 en febrero pasa a ser el 28/29). */
export function chargeDate(ym: string, day: number) {
  const last = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate();
  return `${ym}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

/** Meses (YYYY-MM) que faltan por apuntar de un gasto fijo hasta hoy. */
export function pendingMonths(r: Pick<RecurringTransaction, "start_month" | "last_month" | "day_of_month">, today: string) {
  let ym = r.start_month.slice(0, 7);
  if (r.last_month) {
    const next = addMonths(r.last_month.slice(0, 7), 1);
    if (next > ym) ym = next;
  }
  const out: string[] = [];
  for (; ym <= today.slice(0, 7) && out.length < 24; ym = addMonths(ym, 1)) {
    if (chargeDate(ym, r.day_of_month) <= today) out.push(ym);
  }
  return out;
}

/**
 * Apunta los gastos fijos que ya tocan y aún no están en movimientos.
 * Se llama al cargar Finanzas y el Resumen. Devuelve la respuesta de Supabase para mostrar errores.
 */
export async function ensureRecurring(supabase: Supabase, today: string) {
  const res = await supabase.from("recurring_transactions").select("*");
  if (res.error) return { res, items: [] as RecurringTransaction[] };
  const items = ((res.data ?? []) as RecurringTransaction[]).map((r) => ({ ...r, amount: Number(r.amount) }));

  for (const r of items) {
    const months = pendingMonths(r, today);
    if (!months.length) continue;
    const { error } = await supabase.from("transactions").upsert(
      months.map((ym) => ({
        kind: r.kind, amount: r.amount, category: r.category, description: r.description,
        payment_method: r.payment_method, date: chargeDate(ym, r.day_of_month), recurring_id: r.id,
      })),
      { onConflict: "recurring_id,date", ignoreDuplicates: true },
    );
    if (error) return { res: { error }, items };
    const last = `${months[months.length - 1]}-01`;
    await supabase.from("recurring_transactions").update({ last_month: last }).eq("id", r.id);
    r.last_month = last;
  }
  return { res, items };
}
