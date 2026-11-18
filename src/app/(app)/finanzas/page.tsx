import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, PiggyBank, Receipt, Wallet } from "lucide-react";
import { dbError } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { addMonths, eur, fmtDate, isYearMonth, monthLabel, todayISO } from "@/lib/format";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, KINDS, SAVINGS_CATEGORIES, type Transaction } from "@/lib/types";
import { saveTransaction } from "@/lib/actions";
import { CardTitle, DbError, Empty, Field, Kpi, PageHeader, Tabs } from "@/components/ui";
import Donut from "@/components/Donut";
import SubmitButton from "@/components/SubmitButton";
import DeleteButton from "@/components/DeleteButton";

type SP = Promise<{ month?: string; cat?: string; tipo?: string; edit?: string }>;

const KIND_STYLE = {
  gasto: "peer-checked:border-rose-500/40 peer-checked:bg-rose-500/20 peer-checked:text-rose-300",
  ingreso: "peer-checked:border-emerald-500/40 peer-checked:bg-emerald-500/20 peer-checked:text-emerald-300",
  ahorro: "peer-checked:border-sky-500/40 peer-checked:bg-sky-500/20 peer-checked:text-sky-300",
};

export default async function FinancePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const today = todayISO();
  const ym = isYearMonth(sp.month) ? sp.month : today.slice(0, 7);
  const firstMonth = addMonths(ym, -5);
  const supabase = await createClient();

  const [mainRes, histRes, editRes] = await Promise.all([
    supabase.from("transactions").select("*").gte("date", `${ym}-01`).lt("date", `${addMonths(ym, 1)}-01`)
      .order("date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("transactions").select("kind,amount,date").gte("date", `${firstMonth}-01`).lt("date", `${addMonths(ym, 1)}-01`),
    sp.edit ? supabase.from("transactions").select("*").eq("id", sp.edit).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const all = ((mainRes.data ?? []) as Transaction[]).map((t) => ({ ...t, amount: Number(t.amount) }));
  const editing = editRes.data as Transaction | null;

  const sum = (k: Transaction["kind"]) => all.filter((t) => t.kind === k).reduce((s, t) => s + t.amount, 0);
  const income = sum("ingreso");
  const expense = sum("gasto");
  const savings = sum("ahorro");
  const available = income - expense - savings;

  const byCat = new Map<string, number>();
  for (const t of all) if (t.kind === "gasto") byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount);
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);

  // Evolución de los últimos 6 meses
  const months = Array.from({ length: 6 }, (_, i) => addMonths(firstMonth, i));
  const evo = new Map(months.map((m) => [m, { ingreso: 0, gasto: 0, ahorro: 0 }]));
  for (const t of (histRes.data ?? []) as Pick<Transaction, "kind" | "amount" | "date">[]) {
    const e = evo.get(t.date.slice(0, 7));
    if (e) e[t.kind] += Number(t.amount);
  }
  const maxEvo = Math.max(1, ...[...evo.values()].flatMap((e) => [e.ingreso, e.gasto]));

  const tipo = sp.tipo === "gasto" || sp.tipo === "ingreso" || sp.tipo === "ahorro" ? sp.tipo : null;
  const list = all.filter((t) => (!sp.cat || t.category === sp.cat) && (!tipo || t.kind === tipo));

  const base = `/finanzas?month=${ym}`;
  const catParam = sp.cat ? `&cat=${encodeURIComponent(sp.cat)}` : "";
  const back = `${base}${tipo ? `&tipo=${tipo}` : ""}${catParam}`;
  const daysElapsed = ym === today.slice(0, 7) ? Number(today.slice(8)) : new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5), 0)).getUTCDate();

  return (
    <div className="space-y-6">
      <DbError message={dbError(mainRes, histRes, editRes)} />
      <PageHeader title="Gastos e ingresos">
        <Link href={`/finanzas?month=${addMonths(ym, -1)}`} className="btn" aria-label="Mes anterior"><ChevronLeft className="h-4 w-4" /></Link>
        <span className="min-w-36 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-center font-mono text-xs text-emerald-400">{monthLabel(ym)}</span>
        <Link href={`/finanzas?month=${addMonths(ym, 1)}`} className="btn" aria-label="Mes siguiente"><ChevronRight className="h-4 w-4" /></Link>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Ingresos del mes" accent="emerald" icon={<ArrowUpRight className="h-4 w-4" />} value={<span className="text-emerald-400">{eur(income)}</span>} />
        <Kpi label="Gastos del mes" accent="rose" icon={<ArrowDownRight className="h-4 w-4" />} value={<span className="text-rose-400">{eur(expense)}</span>}
          hint={`Media diaria ${eur(expense / Math.max(daysElapsed, 1))}`} />
        <Kpi label="Ahorrado" accent="sky" icon={<PiggyBank className="h-4 w-4" />} value={<span className="text-sky-400">{eur(savings)}</span>}
          extra={income > 0 ? `${Math.round((savings / income) * 100)}% ingresos` : undefined} />
        <div className="card border-emerald-500/30 bg-gradient-to-br from-slate-900 to-emerald-950/30">
          <div className="mb-3 flex items-center justify-between">
            <span className="kpi-label text-slate-300">Disponible neto</span>
            <Wallet className="h-4 w-4 text-emerald-400" />
          </div>
          <p className={`font-mono text-2xl font-bold ${available >= 0 ? "text-white" : "text-rose-400"}`}>{eur(available)}</p>
          <p className="mt-2 text-xs text-slate-400">ingresos − gastos − ahorro</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <form id="nuevo" action={saveTransaction} className="card h-fit flex flex-col gap-4 lg:col-span-5" key={editing?.id ?? "new"}>
          <h2 className="flex items-center gap-2 text-base font-semibold text-white">
            <Receipt className="h-4 w-4 text-emerald-400" /> {editing ? "Editar movimiento" : "Registrar movimiento"}
          </h2>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <input type="hidden" name="back" value={back} />
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-800 bg-slate-950 p-1">
            {(["gasto", "ingreso", "ahorro"] as const).map((k) => (
              <label key={k} className="cursor-pointer">
                <input type="radio" name="kind" value={k} defaultChecked={(editing?.kind ?? tipo ?? "gasto") === k} className="peer sr-only" />
                <div className={`rounded-lg border border-transparent py-2 text-center text-xs font-semibold text-slate-400 transition-all ${KIND_STYLE[k]}`}>
                  {KINDS[k].sign} {KINDS[k].label}
                </div>
              </label>
            ))}
          </div>
          <Field label="Concepto">
            <input className="input" name="description" defaultValue={editing?.description ?? ""} placeholder="Ej. Compra Mercadona, Spotify…" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cantidad (€) *">
              <input className="input font-mono" name="amount" type="number" step="0.01" min="0.01" required inputMode="decimal" defaultValue={editing?.amount} placeholder="0,00" />
            </Field>
            <Field label="Fecha">
              <input className="input font-mono" type="date" name="date" defaultValue={editing?.date ?? today} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoría">
              <input className="input" name="category" list="categorias" defaultValue={editing?.category ?? sp.cat ?? ""} placeholder="Supermercado…" />
              <datalist id="categorias">
                {[...new Set([...cats.map(([c]) => c), ...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...SAVINGS_CATEGORIES])].map((c) => <option key={c} value={c} />)}
              </datalist>
            </Field>
            <Field label="Método de pago">
              <select className="input" name="payment_method" defaultValue={editing?.payment_method ?? ""}>
                <option value="">—</option>
                <option>Tarjeta</option>
                <option>Efectivo</option>
                <option>Bizum</option>
                <option>Transferencia</option>
                <option>Domiciliación</option>
              </select>
            </Field>
          </div>
          <div className="flex gap-2">
            <SubmitButton className="btn w-full border-emerald-600 bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500">
              {editing ? "Guardar cambios" : "Guardar en el cuaderno"}
            </SubmitButton>
            {editing && <Link href={back} className="btn">Cancelar</Link>}
          </div>
        </form>

        <section className="card lg:col-span-7">
          <CardTitle title="Gastos por categoría" accent="emerald">
            {sp.cat && <Link href={base} className="btn btn-sm">Quitar filtro</Link>}
          </CardTitle>
          {cats.length === 0 ? (
            <Empty>Sin gastos este mes</Empty>
          ) : (
            <Donut items={cats} centerLabel="Gastado" selected={sp.cat} hrefFor={(c) => `${base}&cat=${encodeURIComponent(c)}`} />
          )}
        </section>
      </div>

      <section className="card">
        <CardTitle title="Evolución de los últimos 6 meses" accent="emerald">
          <span className="flex gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-400" />Ingresos</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-rose-400" />Gastos</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-sky-400" />Ahorro</span>
          </span>
        </CardTitle>
        <div className="flex h-44 items-end gap-3">
          {months.map((m) => {
            const e = evo.get(m)!;
            return (
              <Link key={m} href={`/finanzas?month=${m}`} className={`flex h-full flex-1 flex-col justify-end gap-1 rounded-lg p-1 ${m === ym ? "bg-slate-800/50" : "hover:bg-slate-800/30"}`}>
                <div className="flex h-full items-end justify-center gap-1">
                  <div className="w-1/4 rounded-t bg-emerald-400/90" style={{ height: `${(e.ingreso / maxEvo) * 100}%` }} title={`Ingresos ${eur(e.ingreso)}`} />
                  <div className="w-1/4 rounded-t bg-rose-400/90" style={{ height: `${(e.gasto / maxEvo) * 100}%` }} title={`Gastos ${eur(e.gasto)}`} />
                  <div className="w-1/4 rounded-t bg-sky-400/90" style={{ height: `${(e.ahorro / maxEvo) * 100}%` }} title={`Ahorro ${eur(e.ahorro)}`} />
                </div>
                <span className={`text-center font-mono text-[10px] capitalize ${m === ym ? "text-white" : "text-slate-400"}`}>
                  {fmtDate(`${m}-01`, { month: "short" })}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="card">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <h2 className="text-base font-semibold text-white">Historial de movimientos{sp.cat ? ` · ${sp.cat}` : ""}</h2>
          <Tabs
            items={[
              { href: `${base}${catParam}`, label: "Todos", active: !tipo },
              { href: `${base}&tipo=gasto${catParam}`, label: "Gastos", active: tipo === "gasto" },
              { href: `${base}&tipo=ingreso`, label: "Ingresos", active: tipo === "ingreso" },
              { href: `${base}&tipo=ahorro`, label: "Ahorro", active: tipo === "ahorro" },
            ]}
          />
        </div>
        {list.length === 0 ? (
          <Empty>No hay movimientos</Empty>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 font-mono text-[11px] uppercase text-slate-400">
                  <th className="px-2 py-3">Fecha</th>
                  <th className="px-2 py-3">Concepto</th>
                  <th className="hidden px-2 py-3 sm:table-cell">Categoría</th>
                  <th className="hidden px-2 py-3 md:table-cell">Tipo</th>
                  <th className="px-2 py-3 text-right">Importe</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {list.map((t) => (
                  <tr key={t.id} className="transition-colors hover:bg-slate-850/70">
                    <td className="whitespace-nowrap px-2 py-3 font-mono text-xs capitalize text-slate-400">{fmtDate(t.date, { day: "2-digit", month: "short" })}</td>
                    <td className="px-2 py-3">
                      <p className="font-medium text-slate-200">{t.description || t.category}</p>
                      <p className="text-xs text-slate-500 sm:hidden">{t.category}</p>
                      {t.payment_method && <p className="hidden text-xs text-slate-500 sm:block">{t.payment_method}</p>}
                    </td>
                    <td className="hidden px-2 py-3 sm:table-cell">
                      <Link href={`${base}&cat=${encodeURIComponent(t.category)}`} className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300 hover:text-white">{t.category}</Link>
                    </td>
                    <td className={`hidden px-2 py-3 font-mono text-xs md:table-cell ${KINDS[t.kind].color}`}>{KINDS[t.kind].label}</td>
                    <td className={`whitespace-nowrap px-2 py-3 text-right font-mono font-semibold ${KINDS[t.kind].color}`}>{KINDS[t.kind].sign}{eur(t.amount)}</td>
                    <td className="px-2 py-3">
                      <div className="flex justify-end gap-1">
                        <Link href={`${back}&edit=${t.id}#nuevo`} className="btn btn-sm">Editar</Link>
                        <DeleteButton table="transactions" id={t.id} back={back} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
