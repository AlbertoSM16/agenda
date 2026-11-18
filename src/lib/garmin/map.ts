// Conversión de datos de Garmin Connect al modelo de la agenda. Puro (sin E/S) para poder probarlo.
import type { Lap, Sport } from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type GarminActivity = Record<string, any> & { activityId: number };

export function sportOf(typeKey: string | null | undefined): Sport {
  const t = (typeKey ?? "").toLowerCase();
  if (/swim/.test(t)) return "natacion";
  if (/cycl|bik|ride|bmx|gravel|spinning/.test(t)) return "bici";
  if (/run/.test(t)) return "carrera";
  if (/strength|indoor_cardio|hiit|fitness_equipment|crossfit|weight|bouldering|elliptical|stair|rowing_v2|indoor_rowing/.test(t)) {
    return "gimnasio";
  }
  return "otro";
}

const n = (v: unknown): number | null => {
  const x = Number(v);
  return v === null || v === undefined || v === "" || !Number.isFinite(x) ? null : x;
};

/** Garmin a veces da el largo de piscina en centímetros. */
const poolMeters = (v: unknown) => {
  const x = n(v);
  return x === null ? null : x > 100 ? x / 100 : x;
};

export function mapActivity(a: GarminActivity) {
  const typeKey: string | null = a.activityType?.typeKey ?? null;
  return {
    garmin_activity_id: a.activityId,
    source: "garmin" as const,
    sport: sportOf(typeKey),
    garmin_type: typeKey,
    title: (a.activityName as string | undefined)?.trim() || typeKey || "Actividad",
    started_at: String(a.startTimeLocal ?? a.startTimeGMT).replace(" ", "T"),
    duration_s: n(a.duration),
    moving_s: n(a.movingDuration),
    distance_m: n(a.distance),
    elevation_gain_m: n(a.elevationGain),
    avg_hr: n(a.averageHR),
    max_hr: n(a.maxHR),
    avg_speed_mps: n(a.averageSpeed),
    max_speed_mps: n(a.maxSpeed),
    calories: n(a.calories),
    avg_power: n(a.avgPower),
    norm_power: n(a.normPower),
    avg_cadence: n(
      a.averageBikingCadenceInRevPerMinute ?? a.averageRunningCadenceInStepsPerMinute ?? a.averageSwimCadenceInStrokesPerMinute,
    ),
    pool_length_m: poolMeters(a.poolLength),
    avg_swolf: n(a.averageSwolf ?? a.avgSwolf),
    strokes: n(a.strokes ?? a.totalNumberOfStrokes),
    aerobic_te: n(a.aerobicTrainingEffect),
    anaerobic_te: n(a.anaerobicTrainingEffect),
    training_load: n(a.activityTrainingLoad),
    vo2max: n(a.vO2MaxValue),
    raw: a,
  };
}

export function mapLaps(splits: { lapDTOs?: Record<string, any>[] } | null): Lap[] {
  return (splits?.lapDTOs ?? []).map((l) => ({
    distance_m: n(l.distance),
    duration_s: n(l.duration),
    avg_hr: n(l.averageHR),
    avg_speed_mps: n(l.averageSpeed),
    avg_power: n(l.averagePower),
    elevation_gain_m: n(l.elevationGain),
  }));
}

/** "BARBELL_BENCH_PRESS" → "Barbell bench press". */
export function humanizeExercise(key: string) {
  const s = key.replace(/_/g, " ").toLowerCase().trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export type GarminSet = { garmin_key: string; reps: number | null; weight_kg: number | null; duration_s: number | null };

/** Series activas de una sesión de fuerza. Garmin da el peso en gramos. */
export function mapExerciseSets(data: { exerciseSets?: Record<string, any>[] } | null): GarminSet[] {
  return (data?.exerciseSets ?? [])
    .filter((s) => s.setType === "ACTIVE")
    .map((s) => {
      const ex = (s.exercises ?? [])[0] ?? {};
      const key: string = ex.name || ex.category || "UNKNOWN";
      const w = n(s.weight);
      return {
        garmin_key: key,
        reps: n(s.repetitionCount),
        weight_kg: w === null || w < 0 ? null : w > 1000 ? Math.round(w / 10) / 100 : w,
        duration_s: n(s.duration),
      };
    });
}

/** 1RM estimado (fórmula de Epley). */
export function e1rm(weight: number | null, reps: number | null) {
  if (!weight || !reps) return null;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}
