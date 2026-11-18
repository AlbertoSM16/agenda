import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, todayISO } from "../format";
import type { Workout } from "../types";
import { garminClient } from "./api";
import { humanizeExercise, mapActivity, mapExerciseSets, mapLaps, type GarminActivity, type GarminSet } from "./map";

const PAGE = 50;
const FIRST_SYNC_DAYS = 180;
const MAX_STRENGTH_DETAILS = 20;

/** Importa las actividades nuevas de Garmin. Devuelve cuántas se han importado. */
export async function syncGarmin(supabase: SupabaseClient): Promise<number> {
  const g = await garminClient(supabase);
  if (!g) throw new Error("Garmin no está conectado.");

  try {
    const { data: known, error } = await supabase.from("workouts").select("garmin_activity_id").not("garmin_activity_id", "is", null);
    if (error) throw new Error(error.message);
    const knownIds = new Set((known ?? []).map((r) => Number(r.garmin_activity_id)));
    const since = knownIds.size === 0 ? addDays(todayISO(), -FIRST_SYNC_DAYS) : null;

    const fresh: GarminActivity[] = [];
    for (let start = 0; start < 2000; start += PAGE) {
      const page = (await g.get<GarminActivity[]>(`/activitylist-service/activities/search/activities?start=${start}&limit=${PAGE}`)) ?? [];
      let stop = page.length < PAGE;
      for (const a of page) {
        if (knownIds.has(Number(a.activityId))) { stop = true; continue; }
        if (since && String(a.startTimeLocal ?? "") < since) { stop = true; continue; }
        fresh.push(a);
      }
      if (stop) break;
    }

    if (fresh.length) {
      const rows = fresh.map((a) => ({ ...mapActivity(a), user_id: g.userId }));
      const { data: inserted, error: insError } = await supabase
        .from("workouts")
        .upsert(rows, { onConflict: "user_id,garmin_activity_id", ignoreDuplicates: true })
        .select("id, garmin_activity_id, sport, started_at");
      if (insError) throw new Error(insError.message);

      // Series de las sesiones de fuerza más recientes.
      const strength = (inserted ?? [])
        .filter((w) => w.sport === "gimnasio")
        .sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))
        .slice(0, MAX_STRENGTH_DETAILS);
      for (const w of strength) {
        const sets = mapExerciseSets(await g.get(`/activity-service/activity/${w.garmin_activity_id}/exerciseSets`));
        if (sets.length) await saveGarminSets(supabase, g.userId, w.id, sets);
      }
    }

    await supabase.from("garmin_accounts").update({ last_sync_at: new Date().toISOString(), last_error: null }).eq("user_id", g.userId);
    return fresh.length;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase.from("garmin_accounts").update({ last_sync_at: new Date().toISOString(), last_error: message }).eq("user_id", g.userId);
    throw err;
  }
}

async function saveGarminSets(supabase: SupabaseClient, userId: string, workoutId: string, sets: GarminSet[]) {
  const { data: existing } = await supabase.from("exercises").select("id, name, garmin_key");
  const byKey = new Map<string, string>();
  const byName = new Map<string, { id: string; garmin_key: string | null }>();
  for (const e of existing ?? []) {
    if (e.garmin_key) byKey.set(e.garmin_key, e.id);
    byName.set(e.name.toLowerCase(), e);
  }

  for (const key of new Set(sets.map((s) => s.garmin_key))) {
    if (byKey.has(key)) continue;
    const name = humanizeExercise(key);
    const sameName = byName.get(name.toLowerCase());
    if (sameName) {
      if (!sameName.garmin_key) await supabase.from("exercises").update({ garmin_key: key }).eq("id", sameName.id);
      byKey.set(key, sameName.id);
      continue;
    }
    const { data, error } = await supabase.from("exercises").insert({ user_id: userId, name, garmin_key: key }).select("id").single();
    if (error) throw new Error(error.message);
    byKey.set(key, data.id);
  }

  const { error } = await supabase.from("workout_sets").insert(
    sets.map((s, i) => ({
      user_id: userId,
      workout_id: workoutId,
      exercise_id: byKey.get(s.garmin_key)!,
      set_index: i,
      reps: s.reps,
      weight_kg: s.weight_kg,
      duration_s: s.duration_s,
      source: "garmin",
    })),
  );
  if (error) throw new Error(error.message);
}

/** Descarga (una sola vez) las vueltas de un entreno de Garmin. */
export async function ensureLaps(supabase: SupabaseClient, w: Workout): Promise<Workout> {
  if (w.laps !== null || w.source !== "garmin" || !w.garmin_activity_id || w.sport === "gimnasio") return w;
  try {
    const g = await garminClient(supabase);
    if (!g) return w;
    const laps = mapLaps(await g.get(`/activity-service/activity/${w.garmin_activity_id}/splits`));
    await supabase.from("workouts").update({ laps }).eq("id", w.id);
    return { ...w, laps };
  } catch (err) {
    console.error("Garmin splits:", err);
    return w;
  }
}
