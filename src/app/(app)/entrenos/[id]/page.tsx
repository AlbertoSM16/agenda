import Link from "next/link";
import { notFound } from "next/navigation";
import { dbError } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { fmtClock, fmtDate, fmtKm, fmtKmh, fmtNum, fmtPace, fmtTime, toInputDT } from "@/lib/format";
import { SPORTS, type Exercise, type Workout, type WorkoutSet } from "@/lib/types";
import { SPORT_ORDER } from "@/lib/training";
import { e1rm } from "@/lib/garmin/map";
import { ensureLaps } from "@/lib/garmin/sync";
import { saveWorkout, saveWorkoutSets } from "@/lib/actions-entrenos";
import { DbError, Field } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import DeleteButton from "@/components/DeleteButton";

export const maxDuration = 30;

type Params = Promise<{ id: string }>;
type SP = Promise<{ filas?: string; guardado?: string; editar?: string }>;
type SetRow = WorkoutSet & { exercises: Pick<Exercise, "id" | "name"> | null };

export default async function WorkoutPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const [wRes, setsRes, exRes] = await Promise.all([
    supabase.from("workouts").select("*").eq("id", id).maybeSingle(),
    supabase.from("workout_sets").select("*, exercises(id, name)").eq("workout_id", id).order("set_index"),
    supabase.from("exercises").select("id, name").order("name"),
  ]);
  if (!wRes.data && !wRes.error) notFound();
  const w = wRes.data ? await ensureLaps(supabase, wRes.data as Workout) : null;
  const sets = (setsRes.data ?? []) as SetRow[];
  const exercises = (exRes.data ?? []) as Pick<Exercise, "id" | "name">[];
  if (!w) return <DbError message={dbError(wRes)} />;

  const sport = SPORTS[w.sport];
  const isGym = w.sport === "gimnasio";
  const showSets = isGym || sets.length > 0 || !!sp.filas;
  const extraRows = Math.min(30, Math.max(0, Number(sp.filas ?? (sets.length ? 3 : 6))));
  const rows = [...sets.map((s) => ({ name: s.exercises?.name ?? "", reps: s.reps, kg: s.weight_kg, warm: s.is_warmup })), ...Array.from({ length: extraRows }, () => ({ name: "", reps: null, kg: null, warm: false }))];
  const editing = sp.editar === "1";

  const metrics: [string, string][] = [
    ["Duración", fmtClock(w.duration_s)],
    ...(w.moving_s && w.duration_s && Math.abs(w.moving_s - w.duration_s) > 30 ? [["En movimiento", fmtClock(w.moving_s)] as [string, string]] : []),
  ];
  if (w.sport === "bici") {
    metrics.push(["Distancia", fmtKm(w.distance_m, 2)], ["Velocidad media", fmtKmh(w.avg_speed_mps)], ["Velocidad máx.", fmtKmh(w.max_speed_mps)],
      ["Desnivel +", w.elevation_gain_m ? `${fmtNum(w.elevation_gain_m)} m` : "—"], ["Potencia media", w.avg_power ? `${fmtNum(w.avg_power)} W` : "—"],
      ["Potencia normalizada", w.norm_power ? `${fmtNum(w.norm_power)} W` : "—"], ["Cadencia", w.avg_cadence ? `${fmtNum(w.avg_cadence)} rpm` : "—"]);
  } else if (w.sport === "carrera") {
    metrics.push(["Distancia", fmtKm(w.distance_m, 2)], ["Ritmo medio", w.avg_speed_mps ? `${fmtPace(w.avg_speed_mps)} /km` : "—"],
      ["Mejor ritmo", w.max_speed_mps ? `${fmtPace(w.max_speed_mps)} /km` : "—"], ["Desnivel +", w.elevation_gain_m ? `${fmtNum(w.elevation_gain_m)} m` : "—"],
      ["Cadencia", w.avg_cadence ? `${fmtNum(w.avg_cadence)} ppm` : "—"]);
  } else if (w.sport === "natacion") {
    metrics.push(["Distancia", w.distance_m ? `${fmtNum(w.distance_m)} m` : "—"], ["Ritmo medio", w.avg_speed_mps ? `${fmtPace(w.avg_speed_mps, 100)} /100 m` : "—"],
      ["Piscina", w.pool_length_m ? `${fmtNum(w.pool_length_m)} m` : "—"], ["SWOLF medio", fmtNum(w.avg_swolf)], ["Brazadas", fmtNum(w.strokes)]);
  } else if (w.distance_m) {
    metrics.push(["Distancia", fmtKm(w.distance_m, 2)]);
  }
  metrics.push(["FC media", w.avg_hr ? `${fmtNum(w.avg_hr)} ppm` : "—"], ["FC máx.", w.max_hr ? `${fmtNum(w.max_hr)} ppm` : "—"], ["Calorías", w.calories ? `${fmtNum(w.calories)} kcal` : "—"]);
  if (w.aerobic_te || w.anaerobic_te) metrics.push(["Efecto entreno", `${fmtNum(w.aerobic_te, 1)} aeróbico · ${fmtNum(w.anaerobic_te, 1)} anaeróbico`]);
  if (w.training_load) metrics.push(["Carga", fmtNum(w.training_load)]);
  if (w.vo2max) metrics.push(["VO₂máx", fmtNum(w.vo2max)]);
  const shown = metrics.filter(([, v]) => v !== "—");

  const volume = sets.reduce((s, x) => s + (x.is_warmup ? 0 : Number(x.weight_kg ?? 0) * Number(x.reps ?? 0)), 0);

  return (
    <div className="space-y-6">
      <DbError message={dbError(wRes, setsRes, exRes)} />
      <div className="flex flex-wrap items-start gap-3">
        <span className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl ${sport.badge}`}>{sport.icon}</span>
        <div className="flex-1">
          <Link href="/entrenos" className="text-xs text-indigo-400">← Entrenos</Link>
          <h1 className="text-2xl font-bold">{w.title}</h1>
          <p className="text-sm text-slate-400">
            {(() => { const t = fmtDate(w.started_at, { weekday: "long", day: "numeric", month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); })()} · {fmtTime(w.started_at)} · {sport.label}
            {w.source === "garmin" ? " · ⌚ Garmin" : " · manual"}
            {w.rpe ? ` · RPE ${w.rpe}/10` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/entrenos/${w.id}?editar=1`} className="btn btn-sm">Editar</Link>
          <DeleteButton table="workouts" id={w.id} back="/entrenos" />
        </div>
      </div>

      {sp.guardado && <p className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-300">Series guardadas.</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map(([label, value]) => (
          <div key={label} className="card py-3">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="font-mono text-lg font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      {w.notes && !editing && <p className="card whitespace-pre-wrap text-sm">{w.notes}</p>}

      {editing && (
        <form action={saveWorkout} className="card flex flex-col gap-3">
          <h2 className="h2">Editar entreno</h2>
          <input type="hidden" name="id" value={w.id} />
          <input type="hidden" name="source" value={w.source} />
          <input type="hidden" name="back" value={`/entrenos/${w.id}`} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Título *"><input className="input" name="title" required defaultValue={w.title} /></Field>
            <Field label="RPE (1–10, esfuerzo percibido)"><input className="input" name="rpe" type="number" min="1" max="10" defaultValue={w.rpe ?? ""} /></Field>
            {w.source === "manual" && (
              <>
                <Field label="Deporte">
                  <select className="input" name="sport" defaultValue={w.sport}>
                    {SPORT_ORDER.map((s) => <option key={s} value={s}>{SPORTS[s].icon} {SPORTS[s].label}</option>)}
                  </select>
                </Field>
                <Field label="Fecha y hora"><input className="input" type="datetime-local" name="started_at" required defaultValue={toInputDT(w.started_at)} /></Field>
                <Field label="Duración (min)"><input className="input" name="duration_min" type="number" step="1" min="0" defaultValue={w.duration_s ? Math.round(w.duration_s / 60) : ""} /></Field>
                <Field label="Distancia (km)"><input className="input" name="distance_km" type="text" inputMode="decimal" pattern="[0-9]+([.,][0-9]+)?" defaultValue={w.distance_m ? w.distance_m / 1000 : ""} /></Field>
                <Field label="Desnivel (m)"><input className="input" name="elevation_gain_m" type="number" step="1" defaultValue={w.elevation_gain_m ?? ""} /></Field>
                <Field label="FC media"><input className="input" name="avg_hr" type="number" defaultValue={w.avg_hr ?? ""} /></Field>
                <Field label="FC máx."><input className="input" name="max_hr" type="number" defaultValue={w.max_hr ?? ""} /></Field>
                <Field label="Potencia media (W)"><input className="input" name="avg_power" type="number" defaultValue={w.avg_power ?? ""} /></Field>
                <Field label="Calorías"><input className="input" name="calories" type="number" defaultValue={w.calories ?? ""} /></Field>
              </>
            )}
          </div>
          <Field label="Notas"><textarea className="input" name="notes" rows={3} defaultValue={w.notes ?? ""} placeholder="Sensaciones, molestias, objetivo…" /></Field>
          <div className="flex gap-2">
            <SubmitButton>Guardar</SubmitButton>
            <Link href={`/entrenos/${w.id}`} className="btn">Cancelar</Link>
          </div>
        </form>
      )}

      {w.laps && w.laps.length > 1 && (
        <section className="card overflow-x-auto">
          <h2 className="h2">Vueltas</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-400">
              <tr>
                <th className="py-1 pr-3">#</th><th className="pr-3">Distancia</th><th className="pr-3">Tiempo</th>
                <th className="pr-3">{w.sport === "bici" ? "Velocidad" : "Ritmo"}</th><th className="pr-3">FC</th>
                {w.sport === "bici" && <th className="pr-3">Potencia</th>}<th>Desnivel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {w.laps.map((l, i) => (
                <tr key={i}>
                  <td className="py-1 pr-3 text-slate-400">{i + 1}</td>
                  <td className="pr-3">{w.sport === "natacion" ? `${fmtNum(l.distance_m)} m` : fmtKm(l.distance_m, 2)}</td>
                  <td className="pr-3">{fmtClock(l.duration_s)}</td>
                  <td className="pr-3">{w.sport === "bici" ? fmtKmh(l.avg_speed_mps) : fmtPace(l.avg_speed_mps, w.sport === "natacion" ? 100 : 1000)}</td>
                  <td className="pr-3">{fmtNum(l.avg_hr)}</td>
                  {w.sport === "bici" && <td className="pr-3">{l.avg_power ? `${fmtNum(l.avg_power)} W` : "—"}</td>}
                  <td>{l.elevation_gain_m ? `${fmtNum(l.elevation_gain_m)} m` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {showSets && (
        <form action={saveWorkoutSets} className="card flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="h2 mb-0">Series</h2>
            {volume > 0 && <span className="text-sm text-slate-300">Volumen total: <b>{fmtNum(volume)} kg</b></span>}
          </div>
          {sets.some((s) => s.source === "garmin") && (
            <p className="text-xs text-slate-400">⌚ Series detectadas por el reloj: revisa nombres y pesos y guarda.</p>
          )}
          <input type="hidden" name="workout_id" value={w.id} />
          <input type="hidden" name="rows" value={rows.length} />
          <datalist id="ejercicios">{exercises.map((e) => <option key={e.id} value={e.name} />)}</datalist>
          <div className="space-y-2">
            <div className="grid grid-cols-[1.5rem_1fr_4.5rem_5rem_2.5rem] gap-2 text-xs text-slate-400 sm:grid-cols-[1.5rem_1fr_6rem_6rem_6rem_3rem]">
              <span>#</span><span>Ejercicio</span><span>Reps</span><span>Kg</span><span className="hidden sm:block">1RM est.</span><span title="Calentamiento">Cal.</span>
            </div>
            {rows.map((r, i) => {
              const est = r.warm ? null : e1rm(r.kg, r.reps);
              return (
                <div key={i} className="grid grid-cols-[1.5rem_1fr_4.5rem_5rem_2.5rem] items-center gap-2 sm:grid-cols-[1.5rem_1fr_6rem_6rem_6rem_3rem]">
                  <span className="text-xs text-slate-500">{i + 1}</span>
                  <input className="input py-1" name={`ex_${i}`} list="ejercicios" defaultValue={r.name} placeholder={i === 0 ? "Press banca" : ""} />
                  <input className="input py-1" name={`reps_${i}`} type="number" min="0" step="1" inputMode="numeric" defaultValue={r.reps ?? ""} />
                  <input className="input py-1" name={`kg_${i}`} type="text" inputMode="decimal" pattern="[0-9]+([.,][0-9]+)?" defaultValue={r.kg ?? ""} />
                  <span className="hidden text-xs text-slate-400 sm:block">{est ? `${fmtNum(est, 1)} kg` : ""}</span>
                  <input type="checkbox" name={`warm_${i}`} defaultChecked={r.warm} className="h-4 w-4" title="Serie de calentamiento" />
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <SubmitButton>Guardar series</SubmitButton>
            <Link href={`/entrenos/${w.id}?filas=${extraRows + 5}`} className="btn" scroll={false}>+ 5 filas</Link>
          </div>
          <p className="text-xs text-slate-400">Consejo: escribe el ejercicio en cada fila (se autocompleta). Deja la fila vacía para borrarla.</p>
        </form>
      )}
      {!showSets && (
        <p className="text-center text-xs text-slate-400">
          ¿Hiciste también fuerza? <Link href={`/entrenos/${w.id}?filas=6`} className="text-indigo-400 underline">Añadir series</Link>
        </p>
      )}
    </div>
  );
}
