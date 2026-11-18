import Link from "next/link";
import { dbError } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, fmtNum } from "@/lib/format";
import type { Exercise } from "@/lib/types";
import { e1rm } from "@/lib/garmin/map";
import { saveExercise } from "@/lib/actions-entrenos";
import { DbError, Empty, Field, PageHeader } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import DeleteButton from "@/components/DeleteButton";

type SP = Promise<{ ex?: string; editar?: string }>;
type SetRow = {
  exercise_id: string;
  reps: number | null;
  weight_kg: number | null;
  is_warmup: boolean;
  workout_id: string;
  workouts: { started_at: string; title: string } | null;
};
type Session = { workoutId: string; date: string; title: string; best: number; maxKg: number; volume: number; sets: { reps: number | null; kg: number | null }[] };

export default async function ExercisesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [exRes, setsRes] = await Promise.all([
    supabase.from("exercises").select("id, name, muscle_group, garmin_key").order("name"),
    supabase.from("workout_sets").select("exercise_id, reps, weight_kg, is_warmup, workout_id, workouts(started_at, title)").eq("is_warmup", false),
  ]);
  const exercises = (exRes.data ?? []) as Exercise[];
  const sets = (setsRes.data ?? []) as unknown as SetRow[];

  // Agrupa por ejercicio → sesión (entreno).
  const byExercise = new Map<string, Map<string, Session>>();
  for (const s of sets) {
    if (!s.workouts) continue;
    const sessions = byExercise.get(s.exercise_id) ?? new Map<string, Session>();
    byExercise.set(s.exercise_id, sessions);
    const sess = sessions.get(s.workout_id) ?? { workoutId: s.workout_id, date: s.workouts.started_at, title: s.workouts.title, best: 0, maxKg: 0, volume: 0, sets: [] };
    sessions.set(s.workout_id, sess);
    const kg = Number(s.weight_kg ?? 0);
    sess.best = Math.max(sess.best, e1rm(kg, s.reps) ?? 0);
    sess.maxKg = Math.max(sess.maxKg, kg);
    sess.volume += kg * Number(s.reps ?? 0);
    sess.sets.push({ reps: s.reps, kg: s.weight_kg });
  }
  const summary = exercises
    .map((e) => {
      const sessions = [...(byExercise.get(e.id)?.values() ?? [])].sort((a, b) => a.date.localeCompare(b.date));
      return { ...e, sessions, best: Math.max(0, ...sessions.map((s) => s.best)), last: sessions.at(-1)?.date ?? null };
    })
    .sort((a, b) => (b.last ?? "").localeCompare(a.last ?? ""));

  const selected = summary.find((e) => e.id === sp.ex) ?? null;
  const recent = selected?.sessions.slice(-20) ?? [];
  const maxBest = Math.max(1, ...recent.map((s) => s.best));

  return (
    <div className="space-y-6">
      <DbError message={dbError(exRes, setsRes)} />
      <PageHeader title="Ejercicios y progreso">
        <Link href="/entrenos" className="btn">← Entrenos</Link>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card h-fit">
          <h2 className="h2">Tus ejercicios</h2>
          {summary.length === 0 ? (
            <Empty>Aún no hay ejercicios. Se crean al apuntar series en un entreno de gimnasio.</Empty>
          ) : (
            <ul className="divide-y divide-slate-800/70">
              {summary.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/entrenos/ejercicios?ex=${e.id}`}
                    className={`flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-800/50 ${e.id === sp.ex ? "bg-indigo-500/10 font-medium text-indigo-300" : ""}`}
                  >
                    <span className="truncate">{e.name}</span>
                    <span className="shrink-0 text-xs text-slate-400">
                      {e.sessions.length} ses.{e.best ? ` · 1RM ${fmtNum(e.best, 1)}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6 lg:col-span-2">
          {!selected ? (
            <div className="card"><Empty>Elige un ejercicio para ver tu progreso.</Empty></div>
          ) : (
            <>
              <section className="card">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold">{selected.name}</h2>
                    {selected.muscle_group && <p className="text-xs text-slate-400">{selected.muscle_group}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/entrenos/ejercicios?ex=${selected.id}&editar=1`} className="btn btn-sm">Renombrar</Link>
                    <DeleteButton table="exercises" id={selected.id} back="/entrenos/ejercicios" />
                  </div>
                </div>

                {sp.editar === "1" && (
                  <form action={saveExercise} className="mb-4 grid gap-2 rounded-lg bg-slate-950/60 p-3 sm:grid-cols-[1fr_1fr_auto]">
                    <input type="hidden" name="id" value={selected.id} />
                    <input type="hidden" name="back" value={`/entrenos/ejercicios?ex=${selected.id}`} />
                    <Field label="Nombre"><input className="input" name="name" required defaultValue={selected.name} /></Field>
                    <Field label="Grupo muscular"><input className="input" name="muscle_group" defaultValue={selected.muscle_group ?? ""} placeholder="Pecho, pierna…" /></Field>
                    <div className="flex items-end"><SubmitButton>Guardar</SubmitButton></div>
                  </form>
                )}

                <div className="mb-4 grid grid-cols-3 gap-3 text-center">
                  <Stat label="Mejor 1RM estimado" value={selected.best ? `${fmtNum(selected.best, 1)} kg` : "—"} />
                  <Stat label="Peso máximo" value={`${fmtNum(Math.max(0, ...selected.sessions.map((s) => s.maxKg)), 1)} kg`} />
                  <Stat label="Sesiones" value={String(selected.sessions.length)} />
                </div>

                <h3 className="mb-2 text-sm font-medium text-slate-200">1RM estimado por sesión (últimas {recent.length})</h3>
                {recent.length === 0 ? (
                  <Empty>Sin series registradas</Empty>
                ) : (
                  <div className="flex h-40 items-end gap-1">
                    {recent.map((s) => (
                      <Link key={s.workoutId} href={`/entrenos/${s.workoutId}`} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${fmtDate(s.date)}: ${fmtNum(s.best, 1)} kg`}>
                        <span className="text-[10px] text-slate-400">{fmtNum(s.best, 0)}</span>
                        <div className="w-full rounded-t bg-violet-500 hover:bg-violet-600" style={{ height: `${(s.best / maxBest) * 100}%` }} />
                        <span className="text-[10px] text-slate-400">{fmtDate(s.date, { day: "numeric", month: "numeric" })}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              <section className="card">
                <h2 className="h2">Historial</h2>
                <ul className="divide-y divide-slate-800/70">
                  {[...selected.sessions].reverse().map((s) => (
                    <li key={s.workoutId} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-sm">
                      <Link href={`/entrenos/${s.workoutId}`} className="w-28 shrink-0 capitalize text-indigo-400">{fmtDate(s.date)}</Link>
                      <span className="flex-1 text-slate-200">
                        {s.sets.map((x) => `${fmtNum(x.reps)}×${x.kg ? fmtNum(x.kg, 2) : "—"}`).join("  ·  ")}
                      </span>
                      <span className="text-xs text-slate-400">vol. {fmtNum(s.volume)} kg</span>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-950/60 p-2">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
