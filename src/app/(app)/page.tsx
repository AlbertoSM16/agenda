import { dbError } from "@/lib/db";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addDays, addMonths, eur, fmtDate, fmtDuration, fmtKm, fmtTime, mondayOf, todayISO } from "@/lib/format";
import { EVENT_TYPES, PRIORITIES, SPORTS, type AgendaEvent, type ShoppingItem, type Sport, type Task, type Transaction, type Workout } from "@/lib/types";
import { SPORT_ORDER, addTo, emptyTotals, type Totals } from "@/lib/training";
import { toggleTask } from "@/lib/actions";
import { DbError, Empty } from "@/components/ui";

export default async function Dashboard() {
  const supabase = await createClient();
  const today = todayISO();
  const ym = today.slice(0, 7);
  const in7 = addDays(today, 8);

  const [events, tasks, txs, shopping, trainings] = await Promise.all([
    supabase.from("events").select("*").gte("starts_at", today).lt("starts_at", in7).order("starts_at"),
    supabase.from("tasks").select("*").neq("status", "hecha").not("due_date", "is", null).lte("due_date", addDays(today, 7)).order("due_date"),
    supabase.from("transactions").select("kind,amount").gte("date", `${ym}-01`).lt("date", `${addMonths(ym, 1)}-01`),
    supabase.from("shopping_items").select("estimated_price").eq("status", "pendiente"),
    supabase.from("workouts").select("sport,duration_s,distance_m,elevation_gain_m").gte("started_at", mondayOf(today)),
  ]);

  const ev = (events.data ?? []) as AgendaEvent[];
  const todayEvents = ev.filter((e) => e.starts_at.slice(0, 10) === today);
  const nextEvents = ev.filter((e) => e.starts_at.slice(0, 10) !== today);
  const tk = (tasks.data ?? []) as Task[];
  const income = ((txs.data ?? []) as Transaction[]).filter((t) => t.kind === "ingreso").reduce((s, t) => s + Number(t.amount), 0);
  const expense = ((txs.data ?? []) as Transaction[]).filter((t) => t.kind === "gasto").reduce((s, t) => s + Number(t.amount), 0);
  const savings = ((txs.data ?? []) as Transaction[]).filter((t) => t.kind === "ahorro").reduce((s, t) => s + Number(t.amount), 0);
  const available = income - expense - savings;
  const shop = (shopping.data ?? []) as Pick<ShoppingItem, "estimated_price">[];
  const shopTotal = shop.reduce((s, i) => s + Number(i.estimated_price ?? 0), 0);
  const weekTotal = emptyTotals();
  const weekBySport = new Map<Sport, Totals>();
  for (const w of (trainings.data ?? []) as Pick<Workout, "sport" | "duration_s" | "distance_m" | "elevation_gain_m">[]) {
    addTo(weekTotal, w);
    if (!weekBySport.has(w.sport)) weekBySport.set(w.sport, emptyTotals());
    addTo(weekBySport.get(w.sport)!, w);
  }

  return (
    <div className="space-y-6">
      <DbError message={dbError(events, tasks, txs, shopping, trainings)} />
      <div>
        <h1 className="text-2xl font-bold capitalize">{fmtDate(today, { weekday: "long", day: "numeric", month: "long" })}</h1>
        <p className="text-sm text-slate-500">Resumen de tu día</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Ingresos del mes" value={eur(income)} className="text-emerald-600" href="/finanzas" />
        <Stat label="Gastos del mes" value={eur(expense)} className="text-red-600" href="/finanzas" />
        <Stat label="Ahorrado del mes" value={eur(savings)} className="text-sky-600" href="/finanzas" />
        <Stat label="Disponible" value={eur(available)} className={available >= 0 ? "text-emerald-600" : "text-red-600"} href="/finanzas" />
        <Stat label={`Lista de compras (${shop.length})`} value={eur(shopTotal)} href="/compras" />
      </div>

      <Link href="/entrenos" className="card flex flex-wrap items-center gap-x-4 gap-y-2 hover:border-indigo-300">
        <span className="text-sm font-semibold">🏃 Entrenos esta semana</span>
        <span className="text-sm text-slate-600">
          {weekTotal.sessions} sesiones · {fmtDuration(weekTotal.seconds)}{weekTotal.meters > 0 ? ` · ${fmtKm(weekTotal.meters)}` : ""}
        </span>
        <span className="flex flex-wrap gap-1">
          {SPORT_ORDER.filter((s) => weekBySport.has(s)).map((s) => (
            <span key={s} className={`badge ${SPORTS[s].badge}`}>{SPORTS[s].icon} {weekBySport.get(s)!.sessions}</span>
          ))}
        </span>
      </Link>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <div className="flex items-center justify-between">
            <h2 className="h2">Hoy</h2>
            <Link href={`/calendario?day=${today}`} className="btn btn-sm">+ Evento</Link>
          </div>
          {todayEvents.length === 0 ? <Empty>Nada programado para hoy</Empty> : <EventList events={todayEvents} />}
          <h2 className="h2 mt-5">Próximos 7 días</h2>
          {nextEvents.length === 0 ? <Empty>Sin eventos próximos</Empty> : <EventList events={nextEvents} showDate />}
        </section>

        <section className="card">
          <div className="flex items-center justify-between">
            <h2 className="h2">Tareas urgentes</h2>
            <Link href="/tareas" className="btn btn-sm">Ver todas</Link>
          </div>
          {tk.length === 0 ? (
            <Empty>No tienes tareas con fecha para esta semana 🎉</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {tk.map((t) => {
                const overdue = t.due_date! < today;
                return (
                  <li key={t.id} className="flex items-center gap-3 py-2">
                    <form action={toggleTask}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="done" value="1" />
                      <input type="hidden" name="back" value="/" />
                      <button className="h-5 w-5 rounded border border-slate-400 hover:bg-emerald-100" title="Marcar como hecha" />
                    </form>
                    <span className="flex-1 text-sm">{t.title}</span>
                    <span className={`badge ${PRIORITIES[t.priority].color}`}>{PRIORITIES[t.priority].label}</span>
                    <span className={`text-xs ${overdue ? "font-semibold text-red-600" : "text-slate-500"}`}>
                      {overdue ? "Vencida · " : ""}{t.due_date === today ? "Hoy" : fmtDate(t.due_date!)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, className = "", href }: { label: string; value: string; className?: string; href: string }) {
  return (
    <Link href={href} className="card block hover:border-indigo-300">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${className}`}>{value}</p>
    </Link>
  );
}

function EventList({ events, showDate = false }: { events: AgendaEvent[]; showDate?: boolean }) {
  return (
    <ul className="space-y-2">
      {events.map((e) => (
        <li key={e.id}>
          <Link href={`/calendario?month=${e.starts_at.slice(0, 7)}&edit=${e.id}`} className="flex items-center gap-3 rounded-lg p-2 hover:bg-slate-50">
            <span className="w-24 shrink-0 text-xs text-slate-500">
              {showDate && <span className="block capitalize">{fmtDate(e.starts_at)}</span>}
              {fmtTime(e.starts_at)}{e.ends_at ? ` – ${fmtTime(e.ends_at)}` : ""}
            </span>
            <span className="flex-1 text-sm font-medium">{e.title}</span>
            <span className={`badge ${EVENT_TYPES[e.type].color}`}>{EVENT_TYPES[e.type].label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
