import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addMonths, eur, fmtDate, isYearMonth, monthLabel, todayISO } from "@/lib/format";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, KINDS, SAVINGS_CATEGORIES, type Transaction } from "@/lib/types";
import { saveTransaction } from "@/lib/actions";
import { Empty, Field, PageHeader, Tabs } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import DeleteButton from "@/components/DeleteButton";

type SP = Promise<{ month?: string; cat?: string; tipo?: string; edit?: string }>;

export default async function FinancePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const today = todayISO();
  const ym = isYearMonth(sp.month) ? sp.month : today.slice(0, 7);
  const supabase = await createClient();

  const [{ data }, editRes] = await Promise.all([
    supabase.from("transactions").select("*").gte("date", `${ym}-01`).lt("date", `${addMonths(ym, 1)}-01`)
      .order("date", { ascending: false }).order("created_at", { ascending: false }),
    sp.edit ? supabase.from("transactions").select("*").eq("id", sp.edit).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const all = ((data ?? []) as Transaction[]).map((t) => ({ ...t, amount: Number(t.amount) }));
  const editing = editRes.data as Transaction | null;

  const income = all.filter((t) => t.kind === "ingreso").reduce((s, t) => s + t.amount, 0);
  const expense = all.filter((t) => t.kind === "gasto").reduce((s, t) => s + t.amount, 0);
  const savings = all.filter((t) => t.kind === "ahorro").reduce((s, t) => s + t.amount, 0);
  const available = income - expense - savings;

  const byCat = new Map<string, number>();
  for (const t of all) if (t.kind === "gasto") byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount);
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const maxCat = cats[0]?.[1] ?? 1;

  const tipo = sp.tipo === "gasto" || sp.tipo === "ingreso" || sp.tipo === "ahorro" ? sp.tipo : null;
  const list = all.filter((t) => (!sp.cat || t.category === sp.cat) && (!tipo || t.kind === tipo));

  const base = `/finanzas?month=${ym}`;
  const back = `${base}${tipo ? `&tipo=${tipo}` : ""}${sp.cat ? `&cat=${encodeURIComponent(sp.cat)}` : ""}`;
  const daysElapsed = ym === today.slice(0, 7) ? Number(today.slice(8)) : new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5), 0)).getUTCDate();

  return (
    <div>
      <PageHeader title="Finanzas">
        <Link href={`/finanzas?month=${addMonths(ym, -1)}`} className="btn">←</Link>
        <span className="min-w-36 text-center font-medium capitalize">{monthLabel(ym)}</span>
        <Link href={`/finanzas?month=${addMonths(ym, 1)}`} className="btn">→</Link>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="card"><p className="text-xs text-slate-500">Ingresos</p><p className="text-xl font-bold text-emerald-600">{eur(income)}</p></div>
        <div className="card"><p className="text-xs text-slate-500">Gastos</p><p className="text-xl font-bold text-red-600">{eur(expense)}</p></div>
        <div className="card"><p className="text-xs text-slate-500">Ahorrado</p><p className="text-xl font-bold text-sky-600">{eur(savings)}</p>{income > 0 && <p className="text-xs text-slate-500">{Math.round((savings / income) * 100)}% de los ingresos</p>}</div>
        <div className="card"><p className="text-xs text-slate-500">Disponible</p><p className={`text-xl font-bold ${available >= 0 ? "text-emerald-600" : "text-red-600"}`}>{eur(available)}</p><p className="text-xs text-slate-500">ingresos − gastos − ahorro</p></div>
        <div className="card"><p className="text-xs text-slate-500">Gasto medio diario</p><p className="text-xl font-bold">{eur(expense / Math.max(daysElapsed, 1))}</p></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <h2 className="h2">Gastos por categoría</h2>
            {cats.length === 0 ? (
              <Empty>Sin gastos este mes</Empty>
            ) : (
              <ul className="space-y-2">
                {cats.map(([c, v]) => (
                  <li key={c}>
                    <Link href={`${base}&cat=${encodeURIComponent(c)}`} className="block hover:opacity-80">
                      <div className="flex justify-between text-sm">
                        <span className={sp.cat === c ? "font-semibold text-indigo-700" : ""}>{c}</span>
                        <span className="text-slate-600">{eur(v)} · {Math.round((v / expense) * 100)}%</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-red-400" style={{ width: `${(v / maxCat) * 100}%` }} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="h2 mb-0">Movimientos{sp.cat ? ` · ${sp.cat}` : ""}</h2>
              <div className="flex items-center gap-2">
                {sp.cat && <Link href={base} className="btn btn-sm">Quitar filtro</Link>}
                <Tabs
                  items={[
                    { href: `${base}${sp.cat ? `&cat=${encodeURIComponent(sp.cat)}` : ""}`, label: "Todos", active: !tipo },
                    { href: `${base}&tipo=gasto${sp.cat ? `&cat=${encodeURIComponent(sp.cat)}` : ""}`, label: "Gastos", active: tipo === "gasto" },
                    { href: `${base}&tipo=ingreso`, label: "Ingresos", active: tipo === "ingreso" },
                    { href: `${base}&tipo=ahorro`, label: "Ahorro", active: tipo === "ahorro" },
                  ]}
                />
              </div>
            </div>
            {list.length === 0 ? (
              <Empty>No hay movimientos</Empty>
            ) : (
              <ul className="divide-y divide-slate-100">
                {list.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-3 py-2">
                    <span className="w-20 text-xs capitalize text-slate-500">{fmtDate(t.date)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.description || t.category}</p>
                      <p className="text-xs text-slate-500">{t.category}{t.payment_method ? ` · ${t.payment_method}` : ""}</p>
                    </div>
                    <span className={`font-semibold ${KINDS[t.kind].color}`} title={KINDS[t.kind].label}>
                      {KINDS[t.kind].sign}{eur(t.amount)}
                    </span>
                    <Link href={`${back}&edit=${t.id}`} className="btn btn-sm">Editar</Link>
                    <DeleteButton table="transactions" id={t.id} back={back} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <form action={saveTransaction} className="card h-fit space-y-3 lg:sticky lg:top-8" key={editing?.id ?? "new"}>
          <h2 className="h2">{editing ? "Editar movimiento" : "Nuevo movimiento"}</h2>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <input type="hidden" name="back" value={back} />
          <div className="grid grid-cols-3 gap-2">
            {(["gasto", "ingreso", "ahorro"] as const).map((k) => (
              <label key={k} className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 p-2 text-sm has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50">
                <input type="radio" name="kind" value={k} defaultChecked={(editing?.kind ?? tipo ?? "gasto") === k} />
                {KINDS[k].label}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Importe (€) *">
              <input className="input" name="amount" type="number" step="0.01" min="0.01" required inputMode="decimal" defaultValue={editing?.amount} autoFocus={!editing} />
            </Field>
            <Field label="Fecha">
              <input className="input" type="date" name="date" defaultValue={editing?.date ?? today} />
            </Field>
          </div>
          <Field label="Categoría">
            <input className="input" name="category" list="categorias" defaultValue={editing?.category ?? sp.cat ?? ""} placeholder="Comida, Nómina…" />
            <datalist id="categorias">
              {[...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...SAVINGS_CATEGORIES])].map((c) => <option key={c} value={c} />)}
            </datalist>
          </Field>
          <Field label="Descripción">
            <input className="input" name="description" defaultValue={editing?.description ?? ""} placeholder="Café con Ana" />
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
          <div className="flex gap-2">
            <SubmitButton>{editing ? "Guardar cambios" : "Añadir"}</SubmitButton>
            {editing && <Link href={back} className="btn">Cancelar</Link>}
          </div>
        </form>
      </div>
    </div>
  );
}
