import { fmtDuration, fmtKm, fmtKmh, fmtNum, fmtPace } from "./format";
import type { Sport, Workout } from "./types";

/** Métricas principales de un entreno en una línea, según el deporte. */
export function headline(w: Pick<Workout, "sport" | "duration_s" | "distance_m" | "avg_speed_mps" | "avg_power" | "avg_hr" | "calories">) {
  const parts: string[] = [];
  const add = (v: string | null | false | undefined) => { if (v && v !== "—") parts.push(v); };
  switch (w.sport) {
    case "bici":
      add(fmtKm(w.distance_m)); add(fmtDuration(w.duration_s)); add(fmtKmh(w.avg_speed_mps)); add(w.avg_power ? `${fmtNum(w.avg_power)} W` : null);
      break;
    case "carrera":
      add(fmtKm(w.distance_m, 2)); add(fmtDuration(w.duration_s)); add(w.avg_speed_mps ? `${fmtPace(w.avg_speed_mps)} /km` : null);
      break;
    case "natacion":
      add(w.distance_m ? `${fmtNum(w.distance_m)} m` : null); add(fmtDuration(w.duration_s)); add(w.avg_speed_mps ? `${fmtPace(w.avg_speed_mps, 100)} /100 m` : null);
      break;
    default:
      add(fmtDuration(w.duration_s)); add(w.calories ? `${fmtNum(w.calories)} kcal` : null);
  }
  add(w.avg_hr ? `❤️ ${fmtNum(w.avg_hr)}` : null);
  return parts.join(" · ");
}

export type Totals = { sessions: number; seconds: number; meters: number; elevation: number };
export const emptyTotals = (): Totals => ({ sessions: 0, seconds: 0, meters: 0, elevation: 0 });

export function addTo(t: Totals, w: Pick<Workout, "duration_s" | "distance_m" | "elevation_gain_m">) {
  t.sessions += 1;
  t.seconds += Number(w.duration_s ?? 0);
  t.meters += Number(w.distance_m ?? 0);
  t.elevation += Number(w.elevation_gain_m ?? 0);
}

export const SPORT_ORDER: Sport[] = ["bici", "carrera", "gimnasio", "natacion", "otro"];
