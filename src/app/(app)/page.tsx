import Link from "next/link";
import { CalendarPlus, Clock, Dumbbell, Flame, ListTodo, Plus, ShoppingCart, TrendingUp } from "lucide-react";
import { dbError } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { addDays, addMonths, eur, fmtDate, fmtDuration, fmtKm, fmtNum, fmtTime, mondayOf, nowLocalISO, todayISO, weekdayOf } from "@/lib/format";
import {
  EVENT_TYPES, KINDS, PRIORITIES, SPORTS, WEEKDAYS,
  type AgendaEvent, type PlanDay, type ShoppingItem, type Task, type Transaction, type Workout,
} from "@/lib/types";
import { toggleTask } from "@/lib/actions";
import { ensureRecurring } from "@/lib/recurring";
import { currentPeriodYm, loadPaydays, period, periodLabel } from "@/lib/periods";
import { CardTitle, DbError, Empty, Kpi, PageHeader } from "@/components/ui";

const DAY_LETTERS = ["L", "M", "X", "J", "V", "S", "D"];

export default async function Dashboard() {
  const supabase = await createClient();
  const today = todayISO();
  const now = nowLocalISO();
  const ym = today.slice(0, 7);
  const monthStart = `${ym}-01`;
  const week0 = mondayOf(today);
  const since = week0 < monthStart ? week0 : monthStart;

  const [{ paydays, res: payRes }, { res: recRes }] = await Promise.all([
    loadPaydays(supabase, addMonths(ym, -1), addMonths(ym, 1)),
    ensureRecurring(supabase, today), // apunta los gastos fijos que ya tocan
  ]);
  const pay = period(currentPeriodYm(paydays, today), paydays, today);

  const [events, tasks, txs, lastTxs, shopping, trainings, plan] = await Promise.all([
    supabase.from("events").select("*").gte("starts_at", today).lt("starts_at", addDays(today, 8)).order("starts_at"),
    supabase.from("tasks").select("*").not("due_date", "is", null).lte("due_date", addDays(today, 7)).order("due_date"),
    supabase.from("transactions").select("kind,amount").gte("date", pay.start).lt("date", pay.end),
    supabase.from("transactions").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }).limit(5),
    supabase.from("shopping_items").select("estimated_price").eq("status", "pendiente"),
    supabase.from("workouts").select("id,sport,title,started_at,duration_s,distance_m").gte("started_at", since).order("started_at"),
    supabase.from("training_plan").select("*"),
  ]);

  // Agenda
  const ev = (events.data ?? []) as AgendaEvent[];
  const todayEvents = ev.filter((e) => e.starts_at.slice(0, 10) === today);
  const nextEvents = ev.filter((e) => e.starts_at.slice(0, 10) !== today);
  const pendingToday = todayEvents.filter((e) => e.starts_at.slice(0, 16) >= now);
  const allTasks = (tasks.data ?? []) as Task[];
  const todayTasks = allTasks.filter((t) => t.due_date === today);
  const openTasks = allTasks.filter((t) => t.status !== "hecha" && t.due_date !== today);
  const dayItems = todayEvents.length + todayTasks.length;
  const dayDone = todayEvents.length - pendingToday.length + todayTasks.filter((t) => t.status === "hecha").length;
  const dayProgress = dayItems ? Math.round((dayDone / dayItems) * 100) : 0;

  // Finanzas
  const month = (txs.data ?? []) as Transaction[];
  const sum = (k: Transaction["kind"]) => month.filter((t) => t.kind === k).reduce((s, t) => s + Number(t.amount), 0);
  const income = sum("ingreso");
  const expense = sum("gasto");
  const savings = sum("ahorro");
  const available = income - expense - savings;
  const savingRate = income > 0 ? Math.round(((income - expense) / income) * 100) : null;
  const shop = (shopping.data ?? []) as Pick<ShoppingItem, "estimated_price">[];
  const shopTotal = shop.reduce((s, i) => s + Number(i.estimated_price ?? 0), 0);

  // Entrenos
  const ws = (trainings.data ?? []) as Pick<Workout, "id" | "sport" | "title" | "started_at" | "duration_s" | "distance_m">[];
  const weekWs = ws.filter((w) => w.started_at.slice(0, 10) >= week0);
  const monthWs = ws.filter((w) => w.started_at.slice(0, 10) >= monthStart);
  const planDays = (plan.data ?? []) as PlanDay[];
  const planByDay = new Map(planDays.map((p) => [p.weekday, p]));
  const todayIdx = weekdayOf(today);
  const todayPlan = planByDay.get(todayIdx);
  const todayDone = weekWs.filter((w) => w.started_at.slice(0, 10) === today);
  const plannedSessions = planDays.filter((p) => p.sport !== "descanso").length;
  const runKm = monthWs.filter((w) => w.sport === "carrera").reduce((s, w) => s + Number(w.distance_m ?? 0), 0);
  const rideKm = monthWs.filter((w) => w.sport === "bici").reduce((s, w) => s + Number(w.distance_m ?? 0), 0);
  const gymCount = monthWs.filter((w) => w.sport === "gimnasio").length;
  const weekHours = weekWs.reduce((s, w) => s + Number(w.duration_s ?? 0), 0);

  return (
    <div className="space-y-6">
      <DbError message={dbError(payRes, recRes, events, tasks, txs, lastTxs, shopping, trainings, plan)} />
      <PageHeader title="Resumen general">
        <QuickAction href={`/calendario?day=${today}`} color="indigo" label="Evento" />
        <QuickAction href="/finanzas#nuevo" color="emerald" label="Movimiento €" />
        <QuickAction href="/entrenos?deporte=gimnasio#registro" color="amber" label="Entreno" />
        <QuickAction href="/tareas" color="sky" label="Tarea" />
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-6">
        <Kpi
          href="/finanzas" accent="emerald" label="Balance de la nómina" icon={<TrendingUp className="h-4 w-4" />}
          value={eur(available)} extra={savingRate !== null ? `${savingRate >= 0 ? "+" : ""}${savingRate}% ahorro` : undefined}
          hint={`${periodLabel(pay)} · ingresos ${eur(income)} · gastos ${eur(expense)}${savings ? ` · ahorrado ${eur(savings)}` : ""}`}
        />
        <Kpi
          href="/calendario" accent="indigo" label="Eventos hoy" icon={<Clock className="h-4 w-4" />}
          value={`${pendingToday.length} pendiente${pendingToday.length === 1 ? "" : "s"}`} extra={`de ${todayEvents.length} hoy`}
          hint={pendingToday[0] ? `Próximo: ${fmtTime(pendingToday[0].starts_at)} · ${pendingToday[0].title}` : "Nada más programado para hoy"}
        />
        <Kpi
          href="/entrenos" accent="amber" label="Entrenamiento hoy" icon={<Flame className="h-4 w-4" />}
          value={<span className="font-sans text-xl">{todayDone[0]?.title ?? todayPlan?.title ?? "Sin plan"}</span>}
          extra={todayDone.length ? "✓ hecho" : WEEKDAYS[todayIdx]}
          hint={<>{todayPlan?.details ?? (planDays.length ? "Día libre" : "Define tu plan semanal en Entrenamiento")} · <span className="font-mono text-amber-400">{weekWs.length}{plannedSessions ? `/${plannedSessions}` : ""}</span> esta semana</>}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Agenda de hoy */}
        <section className="card flex flex-col justify-between lg:col-span-5">
          <div>
            <CardTitle title="Agenda de hoy" accent="indigo" href="/calendario" />
            {dayItems === 0 ? (
              <Empty>Nada programado para hoy</Empty>
            ) : (
              <div className="space-y-2.5">
                {todayEvents.map((e) => {
                  const past = e.starts_at.slice(0, 16) < now;
                  return (
                    <Link key={e.id} href={`/calendario?month=${ym}&edit=${e.id}`}
                      className={`flex items-center justify-between gap-2.5 rounded-xl border p-2.5 transition-colors ${past ? "border-slate-800/60 bg-slate-950/60 opacity-60" : "border-slate-800/80 bg-slate-850/90 hover:border-indigo-500/40"}`}>
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="font-mono text-[11px] text-indigo-300">{fmtTime(e.starts_at)}</span>
                        <span className={`truncate text-xs ${past ? "text-slate-500 line-through" : "text-slate-200"}`}>{e.title}</span>
                      </span>
                      <span className={`badge shrink-0 ${EVENT_TYPES[e.type].color}`}>{EVENT_TYPES[e.type].label}</span>
                    </Link>
                  );
                })}
                {todayTasks.map((t) => {
                  const done = t.status === "hecha";
                  return (
                    <form key={t.id} action={toggleTask}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="done" value={done ? "0" : "1"} />
                      <input type="hidden" name="back" value="/" />
                      <button className={`flex w-full items-center justify-between gap-2.5 rounded-xl border p-2.5 text-left transition-colors ${done ? "border-slate-800/60 bg-slate-950/60 opacity-60" : "border-slate-800/80 bg-slate-850/90 hover:border-indigo-500/40"}`}>
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${done ? "border-indigo-500 bg-indigo-500 text-white" : "border-slate-600"}`}>{done && "✓"}</span>
                          <span className={`truncate text-xs ${done ? "text-slate-500 line-through" : "text-slate-200"}`}>{t.title}</span>
                        </span>
                        <span className={`badge shrink-0 ${PRIORITIES[t.priority].color}`}>Tarea</span>
                      </button>
                    </form>
                  );
                })}
              </div>
            )}
          </div>
          <div className="mt-4 border-t border-slate-800/80 pt-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Progreso del día</span>
              <span className="font-mono text-indigo-300">{dayProgress}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${dayProgress}%` }} />
            </div>
          </div>
        </section>

        {/* Últimos movimientos */}
        <section className="card flex flex-col justify-between lg:col-span-4">
          <div>
            <CardTitle title="Últimos movimientos" accent="emerald" href="/finanzas" linkLabel="Cuaderno" />
            {(lastTxs.data ?? []).length === 0 ? (
              <Empty>Sin movimientos</Empty>
            ) : (
              <div className="space-y-2.5">
                {((lastTxs.data ?? []) as Transaction[]).map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-850/90 px-3 py-2">
                    <div className="min-w-0 pr-2">
                      <p className="truncate text-xs font-medium text-slate-200">{t.description || t.category}</p>
                      <span className="text-[10px] capitalize text-slate-400">{t.category} · {fmtDate(t.date, { day: "2-digit", month: "short" })}</span>
                    </div>
                    <span className={`shrink-0 font-mono text-xs font-semibold ${KINDS[t.kind].color}`}>{KINDS[t.kind].sign}{eur(t.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs">
            <span className="text-slate-400">Gasto desde la nómina</span>
            <span className="font-mono font-medium text-rose-400">−{eur(expense)}</span>
          </div>
        </section>

        {/* Semana activa */}
        <section className="card flex flex-col justify-between lg:col-span-3">
          <div>
            <CardTitle title="Semana activa" accent="amber" href="/entrenos" linkLabel="Abrir" />
            <div className="mb-4 grid grid-cols-7 gap-1 text-center">
              {DAY_LETTERS.map((letter, i) => {
                const date = addDays(week0, i);
                const done = weekWs.filter((w) => w.started_at.slice(0, 10) === date);
                const p = planByDay.get(i);
                const isToday = date === today;
                const cls = done.length
                  ? isToday ? "bg-amber-500 font-bold text-slate-950 shadow-md shadow-amber-500/20" : "border border-amber-500/40 bg-amber-500/20 text-amber-300"
                  : isToday ? "border border-amber-500/60 bg-amber-500/10 text-amber-300"
                  : date < today ? "border border-slate-800 bg-slate-800/40 text-slate-500" : "border border-slate-700/60 bg-slate-800/80 text-slate-400";
                const icon = done.length ? "✓" : p ? (p.sport === "descanso" ? "–" : SPORTS[p.sport].icon) : isToday ? "●" : "–";
                return (
                  <div key={letter} className={`rounded-lg p-1.5 ${cls}`} title={done.map((w) => w.title).join(", ") || p?.title || WEEKDAYS[i]}>
                    <div className="font-mono text-[10px]">{letter}</div>
                    <div className="mt-0.5 text-xs">{icon}</div>
                  </div>
                );
              })}
            </div>
            <div className="space-y-2.5">
              <div className="card-inner p-3">
                <div className="text-[11px] capitalize text-slate-400">Running · {fmtDate(today, { month: "long" })}</div>
                <div className="mt-0.5 font-mono text-lg font-bold text-amber-400">{runKm ? fmtKm(runKm) : "0 km"}</div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="card-inner p-3">
                  <div className="text-[11px] text-slate-400">Fuerza (mes)</div>
                  <div className="mt-0.5 font-mono text-lg font-bold text-white">{gymCount}</div>
                </div>
                <div className="card-inner p-3">
                  <div className="text-[11px] text-slate-400">Bici (mes)</div>
                  <div className="mt-0.5 font-mono text-lg font-bold text-white">{rideKm ? fmtNum(rideKm / 1000) : 0}<span className="text-xs text-slate-400"> km</span></div>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-4 text-[11px] text-slate-500">
            {weekHours ? fmtDuration(weekHours) : "0 min"} esta semana{plannedSessions ? ` · objetivo ${plannedSessions} sesiones` : ""}
          </p>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="card">
          <CardTitle title="Próximos 7 días" accent="indigo" href="/calendario" />
          {nextEvents.length === 0 ? (
            <Empty>Sin eventos próximos</Empty>
          ) : (
            <ul className="space-y-2">
              {nextEvents.slice(0, 6).map((e) => (
                <li key={e.id}>
                  <Link href={`/calendario?month=${e.starts_at.slice(0, 7)}&edit=${e.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-slate-800/50">
                    <span className="chip shrink-0 whitespace-nowrap capitalize">{fmtDate(e.starts_at, { weekday: "short", day: "numeric" })} · {fmtTime(e.starts_at)}</span>
                    <span className="truncate text-sm text-slate-200">{e.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <CardTitle title="Tareas pendientes" accent="sky" href="/tareas" />
          {openTasks.length === 0 ? (
            <Empty>Nada urgente esta semana 🎉</Empty>
          ) : (
            <ul className="space-y-2">
              {openTasks.slice(0, 6).map((t) => {
                const overdue = t.due_date! < today;
                return (
                  <li key={t.id} className="flex items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-850/90 p-2.5">
                    <form action={toggleTask}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="done" value="1" />
                      <input type="hidden" name="back" value="/" />
                      <button className="block h-4 w-4 rounded border border-slate-600 hover:border-sky-400 hover:bg-sky-500/20" title="Marcar como hecha" aria-label="Marcar como hecha" />
                    </form>
                    <span className="flex-1 truncate text-xs text-slate-200">{t.title}</span>
                    <span className={`font-mono text-[11px] ${overdue ? "font-semibold text-rose-400" : "text-slate-400"}`}>
                      {overdue ? "Vencida" : fmtDate(t.due_date!, { weekday: "short", day: "numeric" })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card flex flex-col justify-between">
          <CardTitle title="Lista de compras" accent="rose" href="/compras" linkLabel="Abrir" />
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <p className="font-mono text-2xl font-bold text-white">{eur(shopTotal)}</p>
              <p className="text-xs text-slate-400">{shop.length} cosa{shop.length === 1 ? "" : "s"} pendiente{shop.length === 1 ? "" : "s"} de comprar</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-800/80 pt-3 text-center text-[11px] text-slate-400">
            <Link href={`/calendario?day=${today}`} className="flex flex-col items-center gap-1 rounded-lg p-1.5 hover:bg-slate-800/60 hover:text-white"><CalendarPlus className="h-4 w-4 text-indigo-400" />Evento</Link>
            <Link href="/tareas" className="flex flex-col items-center gap-1 rounded-lg p-1.5 hover:bg-slate-800/60 hover:text-white"><ListTodo className="h-4 w-4 text-sky-400" />Tarea</Link>
            <Link href="/entrenos?deporte=gimnasio#registro" className="flex flex-col items-center gap-1 rounded-lg p-1.5 hover:bg-slate-800/60 hover:text-white"><Dumbbell className="h-4 w-4 text-amber-400" />Serie</Link>
          </div>
        </section>
      </div>
    </div>
  );
}

const QA = {
  indigo: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20",
  sky: "border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20",
};

function QuickAction({ href, color, label }: { href: string; color: keyof typeof QA; label: string }) {
  return (
    <Link href={href} className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${QA[color]}`}>
      <Plus className="h-3.5 w-3.5" aria-hidden /> {label}
    </Link>
  );
}
