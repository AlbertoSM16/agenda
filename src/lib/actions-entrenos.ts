"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { back, num, required, str } from "./form";
import { addDays, nowLocalISO, weekdayOf } from "./format";
import { isSport } from "./types";
import { encrypt, decrypt } from "./garmin/crypto";
import { parsePastedTokens, profileName } from "./garmin/api";
import { login as garminSsoLogin, resumeMfa, type GarminTokens, type MfaState } from "./garmin/sso";
import { syncGarmin } from "./garmin/sync";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function currentUserId(supabase: Supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user.id;
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));
const errorUrl = (err: unknown) => `/entrenos?garmin_error=${encodeURIComponent(errorMessage(err))}`;

async function saveTokens(supabase: Supabase, userId: string, tokens: GarminTokens) {
  const { error } = await supabase.from("garmin_accounts").upsert({
    user_id: userId,
    tokens_enc: encrypt(JSON.stringify(tokens)),
    display_name: await profileName(tokens),
    mfa_state_enc: null,
    mfa_expires_at: null,
    last_error: null,
  });
  if (error) throw new Error(error.message);
}

// ---------- Conexión con Garmin ----------

export async function garminLogin(fd: FormData) {
  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  let target: string;
  try {
    // La contraseña solo se usa aquí, para pedir los tokens a Garmin; no se guarda en ningún sitio.
    const result = await garminSsoLogin(required(str(fd, "email"), "email"), String(fd.get("password") ?? ""));
    if (result.status === "mfa") {
      const { error } = await supabase.from("garmin_accounts").upsert({
        user_id: userId,
        mfa_state_enc: encrypt(JSON.stringify(result.state)),
        mfa_expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      });
      if (error) throw new Error(error.message);
      target = "/entrenos?garmin=mfa";
    } else {
      await saveTokens(supabase, userId, result.tokens);
      target = "/entrenos?garmin=conectado";
    }
  } catch (err) {
    console.error("Garmin login:", err);
    target = errorUrl(err);
  }
  revalidatePath("/entrenos");
  redirect(target);
}

export async function garminVerifyMfa(fd: FormData) {
  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  let target: string;
  try {
    const { data } = await supabase.from("garmin_accounts").select("mfa_state_enc, mfa_expires_at").maybeSingle();
    if (!data?.mfa_state_enc || new Date(data.mfa_expires_at) < new Date()) {
      throw new Error("El inicio de sesión ha caducado. Vuelve a introducir tu email y contraseña.");
    }
    const state = JSON.parse(decrypt(data.mfa_state_enc)) as MfaState;
    await saveTokens(supabase, userId, await resumeMfa(state, required(str(fd, "code"), "código")));
    target = "/entrenos?garmin=conectado";
  } catch (err) {
    console.error("Garmin MFA:", err);
    target = errorUrl(err);
  }
  revalidatePath("/entrenos");
  redirect(target);
}

export async function garminPasteTokens(fd: FormData) {
  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  let target: string;
  try {
    await saveTokens(supabase, userId, await parsePastedTokens(required(str(fd, "tokens"), "tokens")));
    target = "/entrenos?garmin=conectado";
  } catch (err) {
    target = errorUrl(err);
  }
  revalidatePath("/entrenos");
  redirect(target);
}

export async function garminCancelMfa() {
  const supabase = await createClient();
  await supabase.from("garmin_accounts").update({ mfa_state_enc: null, mfa_expires_at: null }).not("user_id", "is", null);
  revalidatePath("/entrenos");
  redirect("/entrenos");
}

export async function garminDisconnect() {
  const supabase = await createClient();
  await supabase.from("garmin_accounts").delete().not("user_id", "is", null);
  revalidatePath("/entrenos");
  redirect("/entrenos?garmin=desconectado");
}

export async function garminSyncNow() {
  const supabase = await createClient();
  let target: string;
  try {
    target = `/entrenos?garmin=sincronizado&n=${await syncGarmin(supabase)}`;
  } catch (err) {
    console.error("Garmin sync:", err);
    target = errorUrl(err);
  }
  revalidatePath("/", "layout");
  redirect(target);
}

/** Sincronización en segundo plano al abrir la página (la llama <AutoSync />). */
export async function garminAutoSync(): Promise<{ imported: number; error: string | null }> {
  const supabase = await createClient();
  try {
    const imported = await syncGarmin(supabase);
    if (imported) revalidatePath("/", "layout");
    return { imported, error: null };
  } catch (err) {
    console.error("Garmin auto-sync:", err);
    return { imported: 0, error: errorMessage(err) };
  }
}

// ---------- Entrenos ----------

export async function saveWorkout(fd: FormData) {
  const supabase = await createClient();
  const id = str(fd, "id");
  const rpe = num(fd, "rpe");
  const data: Record<string, unknown> = {
    title: required(str(fd, "title"), "título"),
    rpe: rpe === null ? null : Math.min(10, Math.max(1, Math.round(rpe))),
    notes: str(fd, "notes"),
  };

  // Las métricas solo se editan a mano en los entrenos manuales.
  if (str(fd, "source") !== "garmin") {
    const sport = str(fd, "sport");
    const minutes = num(fd, "duration_min");
    const km = num(fd, "distance_km");
    const duration = minutes === null ? null : minutes * 60;
    const distance = km === null ? null : km * 1000;
    Object.assign(data, {
      sport: isSport(sport) ? sport : "otro",
      started_at: required(str(fd, "started_at"), "fecha"),
      duration_s: duration,
      moving_s: duration,
      distance_m: distance,
      avg_speed_mps: duration && distance ? distance / duration : null,
      elevation_gain_m: num(fd, "elevation_gain_m"),
      avg_hr: num(fd, "avg_hr"),
      max_hr: num(fd, "max_hr"),
      avg_power: num(fd, "avg_power"),
      calories: num(fd, "calories"),
    });
  }

  const { data: saved, error } = id
    ? await supabase.from("workouts").update(data).eq("id", id).select("id").single()
    : await supabase.from("workouts").insert({ ...data, source: "manual" }).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect(id ? back(fd, `/entrenos/${saved.id}`) : `/entrenos/${saved.id}`);
}

/** Reemplaza todas las series de una sesión con las del formulario. */
export async function saveWorkoutSets(fd: FormData) {
  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  const workoutId = required(str(fd, "workout_id"), "entreno");
  const rows = Number(fd.get("rows") ?? 0);

  const parsed: { name: string; reps: number | null; weight: number | null; warmup: boolean }[] = [];
  for (let i = 0; i < rows; i++) {
    const name = str(fd, `ex_${i}`);
    if (!name) continue;
    parsed.push({ name, reps: num(fd, `reps_${i}`), weight: num(fd, `kg_${i}`), warmup: fd.get(`warm_${i}`) === "on" });
  }

  const { data: exercises, error: exError } = await supabase.from("exercises").select("id, name");
  if (exError) throw new Error(exError.message);
  const ids = new Map((exercises ?? []).map((e) => [e.name.toLowerCase(), e.id as string]));
  for (const name of new Set(parsed.map((p) => p.name))) {
    if (ids.has(name.toLowerCase())) continue;
    const { data, error } = await supabase.from("exercises").insert({ user_id: userId, name }).select("id").single();
    if (error) throw new Error(error.message);
    ids.set(name.toLowerCase(), data.id);
  }

  const { error: delError } = await supabase.from("workout_sets").delete().eq("workout_id", workoutId);
  if (delError) throw new Error(delError.message);
  if (parsed.length) {
    const { error } = await supabase.from("workout_sets").insert(
      parsed.map((p, i) => ({
        user_id: userId,
        workout_id: workoutId,
        exercise_id: ids.get(p.name.toLowerCase())!,
        set_index: i,
        reps: p.reps === null ? null : Math.round(p.reps),
        weight_kg: p.weight,
        is_warmup: p.warmup,
      })),
    );
    if (error) throw new Error(error.message);
  }
  revalidatePath("/entrenos", "layout");
  redirect(`/entrenos/${workoutId}?guardado=1`);
}

export async function saveExercise(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("exercises")
    .update({ name: required(str(fd, "name"), "nombre"), muscle_group: str(fd, "muscle_group") })
    .eq("id", required(str(fd, "id"), "id"));
  if (error) {
    throw new Error(error.code === "23505" ? "Ya tienes un ejercicio con ese nombre." : error.message);
  }
  revalidatePath("/entrenos", "layout");
  redirect(back(fd, "/entrenos/ejercicios"));
}

// ---------- Plan semanal ----------

export async function savePlan(fd: FormData) {
  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  const rows: { user_id: string; weekday: number; sport: string; title: string; details: string | null }[] = [];
  const empty: number[] = [];
  for (let d = 0; d < 7; d++) {
    const title = str(fd, `title_${d}`);
    const sport = str(fd, `sport_${d}`) ?? "gimnasio";
    if (!title) { empty.push(d); continue; }
    rows.push({ user_id: userId, weekday: d, sport: isSport(sport) || sport === "descanso" ? sport : "otro", title, details: str(fd, `details_${d}`) });
  }
  if (rows.length) {
    const { error } = await supabase.from("training_plan").upsert(rows, { onConflict: "user_id,weekday" });
    if (error) throw new Error(error.message);
  }
  if (empty.length) {
    const { error } = await supabase.from("training_plan").delete().in("weekday", empty);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/", "layout");
  redirect("/entrenos");
}

/** Registro rápido: añade N series de un ejercicio a la sesión de gimnasio de hoy (la crea si no existe). */
export async function quickGymLog(fd: FormData) {
  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  const name = required(str(fd, "exercise"), "ejercicio");
  const sets = Math.min(20, Math.max(1, Math.round(num(fd, "sets") ?? 1)));
  const reps = num(fd, "reps");
  const weight = num(fd, "weight");
  const now = nowLocalISO();
  const today = now.slice(0, 10);

  const { data: existing } = await supabase
    .from("workouts").select("id").eq("sport", "gimnasio")
    .gte("started_at", today).lt("started_at", addDays(today, 1))
    .order("started_at", { ascending: false }).limit(1).maybeSingle();

  let workoutId = existing?.id as string | undefined;
  if (!workoutId) {
    const { data: plan } = await supabase.from("training_plan").select("title, sport").eq("weekday", weekdayOf(today)).maybeSingle();
    const { data, error } = await supabase
      .from("workouts")
      .insert({ user_id: userId, source: "manual", sport: "gimnasio", title: plan?.sport === "gimnasio" ? plan.title : str(fd, "title") ?? "Fuerza", started_at: now })
      .select("id").single();
    if (error) throw new Error(error.message);
    workoutId = data.id;
  }

  let { data: ex } = await supabase.from("exercises").select("id").ilike("name", name.replace(/[%_]/g, "\\$&")).limit(1).maybeSingle();
  if (!ex) {
    const { data, error } = await supabase.from("exercises").insert({ user_id: userId, name }).select("id").single();
    if (error) throw new Error(error.message);
    ex = data;
  }

  const { data: last } = await supabase.from("workout_sets").select("set_index").eq("workout_id", workoutId)
    .order("set_index", { ascending: false }).limit(1).maybeSingle();
  const start = (last?.set_index ?? -1) + 1;
  const { error } = await supabase.from("workout_sets").insert(
    Array.from({ length: sets }, (_, i) => ({
      user_id: userId, workout_id: workoutId, exercise_id: ex!.id, set_index: start + i,
      reps: reps === null ? null : Math.round(reps), weight_kg: weight,
    })),
  );
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect(`/entrenos?deporte=gimnasio&serie=${encodeURIComponent(name)}`);
}
