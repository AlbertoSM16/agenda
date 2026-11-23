import Link from "next/link";
import { CalendarRange, Dumbbell, PlusSquare, Save, Timer, TrendingUp } from "lucide-react";
import { dbError } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import {
  addDays, fmtClock, fmtDate, fmtDuration, fmtKm, fmtKmh, fmtNum, fmtPace, fmtTime, mondayOf, todayISO, weekdayOf,
} from "@/lib/format";
import { SPORTS, WEEKDAYS, isSport, type PlanDay, type Sport, type Workout } from "@/lib/types";
import { SPORT_ORDER, addTo, emptyTotals, type Totals } from "@/lib/training";
import { quickGymLog, savePlan, saveWorkout } from "@/lib/actions-entrenos";
import { garminConfigured } from "@/lib/garmin/crypto";
import { CardTitle, DbError, Empty, Field, PageHeader, Tabs } from "@/components/ui";
import GarminCard from "@/components/GarminCard";
import SubmitButton from "@/components/SubmitButton";

export const maxDuration = 60;

type SP = Promise<{ deporte?: string; garmin?: string; garmin_error?: string; n?: string; nuevo?: string; plan?: string; serie?: string }>;

type Row = Pick<Workout, "id" | "sport" | "title" | "started_at" | "duration_s" | "distance_m" | "elevation_gain_m" | "avg_speed_mps" | "avg_power" | "avg_hr" | "calories" | "source" | "rpe">;
type SetRow = {
  workout_id: string; exercise_id: string; reps: number | null; weight_kg: number | null; is_warmup: boolean;
  exercises: { name: string } | null; workouts: { started_at: string; title: string } | null;
};

/** ISO 8601: número de semana. */
function isoWeek(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

export default async function TrainingPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const today = todayISO();
  const sport = isSport(sp.deporte) ? sp.deporte : null;
  const week0 = mondayOf(today);
  const firstWeek = addDays(week0, -7 * 7);
  const monthStart = `${today.slice(0, 7)}-01`;
  const since = firstWeek < monthStart ? firstWeek : monthStart;
  const supabase = await createClient();

  let list = supabase
    .from("workouts")
    .select("id,sport,title,started_at,duration_s,distance_m,elevation_gain_m,avg_speed_mps,avg_power,avg_hr,calories,source,rpe")
    .order("started_at", { ascending: false })
    .limit(60);
  if (sport) list = list.eq("sport", sport);

  const [listRes, statsRes, accRes, planRes, setsRes, exRes] = await Promise.all([
    list,
    supabase.from("workouts").select("sport,started_at,duration_s,distance_m,elevation_gain_m,title").gte("started_at", since),
    supabase.from("garmin_accounts").select("display_name,last_sync_at,last_error,tokens_enc,mfa_state_enc,mfa_expires_at").maybeSingle(),
    supabase.from("training_plan").select("*").order("weekday"),
    sport === "gimnasio"
      ? supabase.from("workout_sets").select("workout_id,exercise_id,reps,weight_kg,is_warmup,exercises(name),workouts(started_at,title)").order("created_at", { ascending: false }).limit(80)
      : Promise.resolve({ data: [] }),
    sport === "gimnasio" ? supabase.from("exercises").select("name").order("name") : Promise.resolve({ data: [] }),
  ]);
  const workouts = (listRes.data ?? []) as Row[];
  const stats = (statsRes.data ?? []) as Pick<Workout, "sport" | "started_at" | "duration_s" | "distance_m" | "elevation_gain_m" | "title">[];
  const acc = accRes.data;
  const plan = (planRes.data ?? []) as PlanDay[];
  const planByDay = new Map(plan.map((p) => [p.weekday, p]));

  // Totales semana/mes y horas por semana
  const week = new Map<Sport, Totals>();
  const month = new Map<Sport, Totals>();
  const weekly = Array.from({ length: 8 }, (_, i) => ({ start: addDays(firstWeek, i * 7), bySport: new Map<Sport, number>(), total: 0 }));
  const doneByDate = new Map<string, string[]>();
  for (const w of stats) {
    const d = w.started_at.slice(0, 10);
    if (d >= week0) {
      if (!week.has(w.sport)) week.set(w.sport, emptyTotals());
      addTo(week.get(w.sport)!, w);
      doneByDate.set(d, [...(doneByDate.get(d) ?? []), w.title]);
    }
    if (d >= monthStart) {
      if (!month.has(w.sport)) month.set(w.sport, emptyTotals());
      addTo(month.get(w.sport)!, w);
    }
    const idx = Math.floor((Date.parse(d) - Date.parse(firstWeek)) / (7 * 86400000));
    if (idx >= 0 && idx < 8) {
      const h = Number(w.duration_s ?? 0) / 3600;
      weekly[idx].bySport.set(w.sport, (weekly[idx].bySport.get(w.sport) ?? 0) + h);
      weekly[idx].total += h;
    }
  }
  const maxWeek = Math.max(1, ...weekly.map((w) => w.total));

  // Bitácora de fuerza: series agrupadas por sesión + ejercicio
  const log: { key: string; workoutId: string; date: string; title: string; exercise: string; sets: number; reps: (number | null)[]; maxKg: number }[] = [];
  for (const s of (setsRes.data ?? []) as unknown as SetRow[]) {
    if (s.is_warmup || !s.workouts) continue;
    const key = `${s.workout_id}:${s.exercise_id}`;
    let g = log.find((x) => x.key === key);
    if (!g) {
      g = { key, workoutId: s.workout_id, date: s.workouts.started_at, title: s.workouts.title, exercise: s.exercises?.name ?? "?", sets: 0, reps: [], maxKg: 0 };
      log.push(g);
    }
    g.sets += 1;
    g.reps.push(s.reps);
    g.maxKg = Math.max(g.maxKg, Number(s.weight_kg ?? 0));
  }

  const status = {
    configured: garminConfigured(),
    connected: !!acc?.tokens_enc,
    pendingMfa: !!acc?.mfa_state_enc && !!acc.mfa_expires_at && new Date(acc.mfa_expires_at) > new Date(),
    displayName: acc?.display_name ?? null,
    lastSyncAt: acc?.last_sync_at ?? null,
    lastError: acc?.last_error ?? null,
  };
  const notice =
    sp.garmin === "sincronizado" ? `Sincronización completada: ${sp.n ?? 0} entreno${sp.n === "1" ? "" : "s"} nuevo${sp.n === "1" ? "" : "s"}.`
    : sp.garmin === "conectado" ? "Garmin conectado. Importando tus entrenos de los últimos 6 meses…"
    : sp.garmin === "desconectado" ? "Garmin desconectado."
    : sp.serie ? `Series de «${sp.serie}» guardadas en la sesión de hoy.`
    : null;
  const todayIdx = weekdayOf(today);
  const editingPlan = sp.plan === "1";

  return (
    <div className="space-y-6">
      <DbError message={dbError(listRes, statsRes, accRes, planRes, setsRes, exRes)} />
      <PageHeader title="Entrenamiento">
        <Link href="/entrenos/ejercicios" className="btn"><TrendingUp className="h-4 w-4 text-amber-400" /> Progreso</Link>
        <Link href={`/entrenos?nuevo=1${sport ? `&deporte=${sport}` : ""}#nuevo`} className="btn border-amber-500 bg-amber-500 font-semibold text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400 hover:text-slate-950">
          + Entreno manual
        </Link>
      </PageHeader>

      {notice && <p className="notice-ok">{notice}</p>}
      {sp.garmin_error && <p className="notice-error">⚠️ {sp.garmin_error}</p>}

      <GarminCard status={status} />

      {/* Planificación semanal */}
      <section className="card">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <CalendarRange className="h-4 w-4 text-amber-400" /> Planificación semanal
            </h2>
            <p className="text-xs text-slate-400">Tu rutina tipo; se marca sola con los entrenos que haces cada día</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-fit rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-mono text-xs text-amber-300">Semana {isoWeek(today)}</span>
            {!editingPlan && <Link href="/entrenos?plan=1" className="btn btn-sm">{plan.length ? "Editar plan" : "Crear plan"}</Link>}
          </div>
        </div>

        {editingPlan ? (
          <form action={savePlan} className="flex flex-col gap-2">
            {WEEKDAYS.map((day, d) => {
              const p = planByDay.get(d);
              return (
                <div key={d} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-800 bg-slate-950 p-2.5 sm:grid-cols-[6rem_9rem_1fr_1.5fr] sm:items-center">
                  <span className="font-mono text-xs uppercase text-slate-400">{day}</span>
                  <select className="input py-2" name={`sport_${d}`} defaultValue={p?.sport ?? "gimnasio"}>
                    {SPORT_ORDER.map((s) => <option key={s} value={s}>{SPORTS[s].icon} {SPORTS[s].label}</option>)}
                    <option value="descanso">😴 Descanso</option>
                  </select>
                  <input className="input py-2" name={`title_${d}`} defaultValue={p?.title ?? ""} placeholder="Pecho y tríceps, Series 6×1000…" />
                  <input className="input py-2" name={`details_${d}`} defaultValue={p?.details ?? ""} placeholder="Press banca, fondos… (opcional)" />
                </div>
              );
            })}
            <p className="text-xs text-slate-500">Deja el título vacío en los días sin plan.</p>
            <div className="flex gap-2">
              <SubmitButton className="btn border-amber-500 bg-amber-500 font-semibold text-slate-950 hover:bg-amber-400 hover:text-slate-950">Guardar plan</SubmitButton>
              <Link href="/entrenos" className="btn">Cancelar</Link>
            </div>
          </form>
        ) : plan.length === 0 ? (
          <Empty>Aún no tienes plan semanal. Pulsa «Crear plan» para definir tu rutina (gimnasio, rodajes, bici…).</Empty>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {WEEKDAYS.map((day, d) => {
              const p = planByDay.get(d);
              const date = addDays(week0, d);
              const done = doneByDate.get(date);
              const isToday = d === todayIdx;
              const state = done ? { text: "✓ HECHO", cls: "text-emerald-400" }
                : isToday ? { text: "● HOY", cls: "text-amber-400" }
                : p?.sport === "descanso" ? { text: "DESCANSO", cls: "text-slate-500" }
                : date < today && p ? { text: "✗ SALTADO", cls: "text-rose-400" }
                : { text: p ? SPORTS[p.sport as Sport]?.label.toUpperCase() ?? "" : "LIBRE", cls: "text-slate-400" };
              return (
                <div key={d} className={`rounded-xl border p-3.5 ${isToday ? "border-amber-500/50 bg-amber-500/10" : "border-slate-800 bg-slate-950"}`}>
                  <div className={`mb-1 flex items-center justify-between font-mono text-[11px] ${state.cls}`}>
                    <span>{day.slice(0, 3).toUpperCase()}</span>
                    <span>{state.text}</span>
                  </div>
                  <p className="text-sm font-semibold text-white">{p ? `${p.sport === "descanso" ? "😴" : SPORTS[p.sport as Sport].icon} ${p.title}` : "—"}</p>
                  {(done || p?.details) && <p className="mt-1 text-xs text-slate-400">{done ? done.join(", ") : p?.details}</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Resumen semana / mes */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SummaryCard title="Esta semana" totals={week} />
        <SummaryCard title="Este mes" totals={month} />
      </div>

      {/* Selector de deporte */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <SportTab href="/entrenos" active={!sport}>Todos</SportTab>
        <SportTab href="/entrenos?deporte=gimnasio" active={sport === "gimnasio"}><Dumbbell className="h-4 w-4" /> Fuerza (gimnasio)</SportTab>
        <SportTab href="/entrenos?deporte=carrera" active={sport === "carrera"}>{SPORTS.carrera.icon} Running</SportTab>
        <SportTab href="/entrenos?deporte=bici" active={sport === "bici"}>{SPORTS.bici.icon} Bici</SportTab>
        <SportTab href="/entrenos?deporte=natacion" active={sport === "natacion"}>{SPORTS.natacion.icon} Natación</SportTab>
        <SportTab href="/entrenos?deporte=otro" active={sport === "otro"}>{SPORTS.otro.icon} Otros</SportTab>
      </div>

      {sport === "gimnasio" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <form id="registro" action={quickGymLog} className="card h-fit flex flex-col gap-4 lg:col-span-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <PlusSquare className="h-4 w-4 text-amber-400" /> Registrar serie / ejercicio
            </h2>
            <p className="-mt-2 text-xs text-slate-400">Se añade a tu sesión de fuerza de hoy (se crea si aún no existe).</p>
            <Field label="Ejercicio *">
              <input className="input focus:border-amber-500" name="exercise" list="ejercicios-list" required placeholder="Dominadas lastradas, press banca…" />
              <datalist id="ejercicios-list">{((exRes.data ?? []) as { name: string }[]).map((e) => <option key={e.name} value={e.name} />)}</datalist>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Series"><input className="input font-mono focus:border-amber-500" name="sets" type="number" min="1" max="20" defaultValue={4} required /></Field>
              <Field label="Reps"><input className="input font-mono focus:border-amber-500" name="reps" type="number" min="1" max="100" defaultValue={10} /></Field>
              <Field label="Peso (kg)"><input className="input font-mono focus:border-amber-500" name="weight" type="text" inputMode="decimal" pattern="[0-9]+([.,][0-9]+)?" /></Field>
            </div>
            <SubmitButton className="btn w-full border-amber-500 bg-amber-500 font-semibold text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400 hover:text-slate-950">
              <Save className="h-4 w-4" /> Guardar registro
            </SubmitButton>
          </form>

          <section className="card lg:col-span-7">
            <CardTitle title="Bitácora de fuerza reciente" accent="amber">
              <span className="rounded-lg bg-amber-500/10 px-2.5 py-1 font-mono text-xs text-amber-400">{log.length} registros</span>
            </CardTitle>
            {log.length === 0 ? (
              <Empty>Aún no hay series registradas</Empty>
            ) : (
              <div className="space-y-3">
                {log.slice(0, 15).map((g) => {
                  const sameReps = g.reps.every((r) => r === g.reps[0]);
                  return (
                    <Link key={g.key} href={`/entrenos/${g.workoutId}`} className="card-inner flex flex-col justify-between gap-2 p-3.5 hover:border-amber-500/40 sm:flex-row sm:items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 font-mono text-[11px] text-amber-300">{g.title}</span>
                          <span className="font-mono text-xs capitalize text-slate-400">{g.date.slice(0, 10) === today ? "Hoy" : fmtDate(g.date)}</span>
                        </div>
                        <p className="mt-1.5 text-sm font-semibold text-white">{g.exercise}</p>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="chip">{sameReps && g.reps[0] ? `${g.sets} × ${g.reps[0]} reps` : `${g.sets} series · ${g.reps.filter(Boolean).join("/")} reps`}</span>
                        {g.maxKg > 0 && <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-semibold text-amber-300">{fmtNum(g.maxKg, 2)} kg</span>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Historial */}
      <section className="card">
        <CardTitle title={sport ? `Historial · ${SPORTS[sport].label}` : "Historial de entrenos"} accent="amber">
          <span className="rounded-lg bg-amber-500/10 px-2.5 py-1 font-mono text-xs text-amber-400">
            {sport && sport !== "gimnasio" && month.get(sport)?.meters
              ? `${sport === "natacion" ? `${fmtNum(month.get(sport)!.meters)} m` : fmtKm(month.get(sport)!.meters)} este mes`
              : `${workouts.length} entrenos`}
          </span>
        </CardTitle>
        {workouts.length === 0 ? (
          <Empty>{status.connected ? "Aún no hay entrenos. Pulsa «Sincronizar ahora» o añade uno a mano." : "Conecta Garmin o añade un entreno manual."}</Empty>
        ) : (
          <div className="space-y-3">
            {workouts.map((w) => (
              <Link key={w.id} href={`/entrenos/${w.id}`} className="card-inner flex flex-col justify-between gap-2 p-3.5 transition-colors hover:border-amber-500/40 sm:flex-row sm:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-base ${SPORTS[w.sport].badge}`}>{SPORTS[w.sport].icon}</span>
                  <div className="min-w-0">
                    <span className="font-mono text-xs capitalize text-slate-400">
                      {fmtDate(w.started_at)} · {fmtTime(w.started_at)}{w.source === "garmin" ? " · ⌚" : ""}{w.rpe ? ` · RPE ${w.rpe}` : ""}
                    </span>
                    <p className="truncate text-sm font-semibold text-white">{w.title}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                  <WorkoutChips w={w} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Horas por semana */}
      <section className="card">
        <CardTitle title="Horas por semana (últimas 8)" accent="amber" />
        <div className="flex h-40 items-end gap-2">
          {weekly.map((w) => (
            <div key={w.start} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="font-mono text-[10px] text-slate-400">{w.total ? fmtNum(w.total, 1) : ""}</span>
              <div className="flex w-full flex-col-reverse overflow-hidden rounded-t" style={{ height: `${(w.total / maxWeek) * 100}%` }}>
                {SPORT_ORDER.filter((s) => w.bySport.get(s)).map((s) => (
                  <div key={s} className={SPORTS[s].bar} style={{ height: `${((w.bySport.get(s) ?? 0) / w.total) * 100}%` }} title={`${SPORTS[s].label}: ${fmtNum(w.bySport.get(s), 1)} h`} />
                ))}
              </div>
              <span className="font-mono text-[10px] text-slate-400">{fmtDate(w.start, { day: "numeric", month: "numeric" })}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
          {SPORT_ORDER.map((s) => (
            <span key={s} className="flex items-center gap-1"><span className={`inline-block h-2 w-2 rounded-full ${SPORTS[s].bar}`} />{SPORTS[s].label}</span>
          ))}
        </div>
      </section>

      {sp.nuevo === "1" && (
        <form id="nuevo" action={saveWorkout} className="card flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-white"><Timer className="h-4 w-4 text-amber-400" /> Nuevo entreno manual</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Deporte">
              <select className="input" name="sport" defaultValue={sport ?? "carrera"}>
                {SPORT_ORDER.map((s) => <option key={s} value={s}>{SPORTS[s].icon} {SPORTS[s].label}</option>)}
              </select>
            </Field>
            <Field label="Título *"><input className="input" name="title" required placeholder="Rodaje Z2, Series 1000 m, Pierna…" /></Field>
            <Field label="Fecha y hora *"><input className="input font-mono" type="datetime-local" name="started_at" required defaultValue={`${today}T18:00`} /></Field>
            <Field label="Duración (min)"><input className="input font-mono" name="duration_min" type="number" step="1" min="0" inputMode="numeric" /></Field>
            <Field label="Distancia (km)"><input className="input font-mono" name="distance_km" type="text" inputMode="decimal" pattern="[0-9]+([.,][0-9]+)?" /></Field>
            <Field label="Desnivel (m)"><input className="input font-mono" name="elevation_gain_m" type="number" step="1" min="0" /></Field>
            <Field label="FC media"><input className="input font-mono" name="avg_hr" type="number" step="1" min="0" /></Field>
            <Field label="Calorías"><input className="input font-mono" name="calories" type="number" step="1" min="0" /></Field>
            <Field label="RPE (1–10)"><input className="input font-mono" name="rpe" type="number" min="1" max="10" /></Field>
          </div>
          <Field label="Notas"><textarea className="input" name="notes" rows={2} /></Field>
          <div className="flex gap-2">
            <SubmitButton className="btn border-amber-500 bg-amber-500 font-semibold text-slate-950 hover:bg-amber-400 hover:text-slate-950">Guardar y añadir detalles</SubmitButton>
            <Link href="/entrenos" className="btn">Cancelar</Link>
          </div>
        </form>
      )}
    </div>
  );
}

function SportTab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition-all ${
        active ? "bg-amber-500 font-semibold text-slate-950" : "border border-slate-800 bg-slate-900 font-medium text-slate-300 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}

function WorkoutChips({ w }: { w: Row }) {
  const chips: { text: string; hl?: boolean }[] = [];
  if (w.sport === "carrera") {
    if (w.distance_m) chips.push({ text: fmtKm(w.distance_m, 2), hl: true });
    if (w.avg_speed_mps) chips.push({ text: `${fmtPace(w.avg_speed_mps)} /km` });
  } else if (w.sport === "bici") {
    if (w.distance_m) chips.push({ text: fmtKm(w.distance_m, 1), hl: true });
    if (w.avg_speed_mps) chips.push({ text: fmtKmh(w.avg_speed_mps) });
    if (w.avg_power) chips.push({ text: `${fmtNum(w.avg_power)} W` });
  } else if (w.sport === "natacion") {
    if (w.distance_m) chips.push({ text: `${fmtNum(w.distance_m)} m`, hl: true });
    if (w.avg_speed_mps) chips.push({ text: `${fmtPace(w.avg_speed_mps, 100)} /100 m` });
  } else if (w.calories) {
    chips.push({ text: `${fmtNum(w.calories)} kcal` });
  }
  if (w.duration_s) chips.push({ text: fmtClock(w.duration_s) });
  if (w.avg_hr) chips.push({ text: `❤ ${fmtNum(w.avg_hr)}` });
  return (
    <>
      {chips.map((c) => (
        <span key={c.text} className={c.hl ? "rounded-lg border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 font-semibold text-amber-300" : "chip"}>{c.text}</span>
      ))}
    </>
  );
}

function SummaryCard({ title, totals }: { title: string; totals: Map<Sport, Totals> }) {
  const all = emptyTotals();
  for (const t of totals.values()) { all.sessions += t.sessions; all.seconds += t.seconds; all.meters += t.meters; all.elevation += t.elevation; }
  return (
    <section className="card">
      <CardTitle title={title} accent="amber">
        <span className="font-mono text-xs text-slate-300">{all.sessions} sesiones · {fmtDuration(all.seconds)}</span>
      </CardTitle>
      {all.sessions === 0 ? (
        <Empty>Sin entrenos</Empty>
      ) : (
        <ul className="space-y-2">
          {SPORT_ORDER.filter((s) => totals.get(s)).map((s) => {
            const t = totals.get(s)!;
            return (
              <li key={s} className="card-inner flex items-center gap-3 px-3 py-2 text-sm">
                <span className={`badge ${SPORTS[s].badge}`}>{SPORTS[s].icon} {SPORTS[s].label}</span>
                <span className="font-mono text-xs text-slate-400">{t.sessions}×</span>
                <span className="flex-1 text-right font-mono text-xs text-slate-200">
                  {fmtDuration(t.seconds)}
                  {t.meters > 0 && ` · ${s === "natacion" ? `${fmtNum(t.meters)} m` : fmtKm(t.meters)}`}
                  {t.elevation > 0 && ` · ↗ ${fmtNum(t.elevation)} m`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
