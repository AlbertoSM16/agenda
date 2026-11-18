import Link from "next/link";
import { dbError } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { addDays, fmtDate, fmtDuration, fmtKm, fmtNum, fmtTime, mondayOf, todayISO } from "@/lib/format";
import { SPORTS, isSport, type Sport, type Workout } from "@/lib/types";
import { SPORT_ORDER, addTo, emptyTotals, headline, type Totals } from "@/lib/training";
import { saveWorkout } from "@/lib/actions-entrenos";
import { garminConfigured } from "@/lib/garmin/crypto";
import { DbError, Empty, Field, PageHeader, Tabs } from "@/components/ui";
import GarminCard from "@/components/GarminCard";
import SubmitButton from "@/components/SubmitButton";

export const maxDuration = 60;

type SP = Promise<{ deporte?: string; garmin?: string; garmin_error?: string; n?: string; nuevo?: string }>;

const MESSAGES: Record<string, string> = {
  conectado: "Garmin conectado. Importando tus entrenos de los últimos 6 meses…",
  desconectado: "Garmin desconectado.",
  mfa: "",
};

type Row = Pick<Workout, "id" | "sport" | "title" | "started_at" | "duration_s" | "distance_m" | "elevation_gain_m" | "avg_speed_mps" | "avg_power" | "avg_hr" | "calories" | "source" | "rpe">;

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

  const [listRes, statsRes, accRes] = await Promise.all([
    list,
    supabase.from("workouts").select("sport,started_at,duration_s,distance_m,elevation_gain_m").gte("started_at", since),
    supabase.from("garmin_accounts").select("display_name,last_sync_at,last_error,tokens_enc,mfa_state_enc,mfa_expires_at").maybeSingle(),
  ]);
  const workouts = (listRes.data ?? []) as Row[];
  const stats = (statsRes.data ?? []) as Pick<Workout, "sport" | "started_at" | "duration_s" | "distance_m" | "elevation_gain_m">[];
  const acc = accRes.data;

  // Totales de la semana y del mes por deporte.
  const week = new Map<Sport, Totals>();
  const month = new Map<Sport, Totals>();
  const weekly = Array.from({ length: 8 }, (_, i) => ({ start: addDays(firstWeek, i * 7), bySport: new Map<Sport, number>(), total: 0 }));
  for (const w of stats) {
    const d = w.started_at.slice(0, 10);
    if (d >= week0) addTo(week.get(w.sport) ?? week.set(w.sport, emptyTotals()).get(w.sport)!, w);
    if (d >= monthStart) addTo(month.get(w.sport) ?? month.set(w.sport, emptyTotals()).get(w.sport)!, w);
    const idx = Math.floor((Date.parse(d) - Date.parse(firstWeek)) / (7 * 86400000));
    if (idx >= 0 && idx < 8) {
      const h = Number(w.duration_s ?? 0) / 3600;
      weekly[idx].bySport.set(w.sport, (weekly[idx].bySport.get(w.sport) ?? 0) + h);
      weekly[idx].total += h;
    }
  }
  const maxWeek = Math.max(1, ...weekly.map((w) => w.total));

  const status = {
    configured: garminConfigured(),
    connected: !!acc?.tokens_enc,
    pendingMfa: !!acc?.mfa_state_enc && !!acc.mfa_expires_at && new Date(acc.mfa_expires_at) > new Date(),
    displayName: acc?.display_name ?? null,
    lastSyncAt: acc?.last_sync_at ?? null,
    lastError: acc?.last_error ?? null,
  };
  const notice = sp.garmin === "sincronizado"
    ? `Sincronización completada: ${sp.n ?? 0} entreno${sp.n === "1" ? "" : "s"} nuevo${sp.n === "1" ? "" : "s"}.`
    : sp.garmin ? MESSAGES[sp.garmin] : null;

  return (
    <div className="space-y-6">
      <DbError message={dbError(listRes, statsRes, accRes)} />
      <PageHeader title="Entrenos">
        <Link href="/entrenos/ejercicios" className="btn">🏋️ Ejercicios y progreso</Link>
        <Link href="/entrenos?nuevo=1#nuevo" className="btn-primary">+ Entreno manual</Link>
      </PageHeader>

      {notice && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {sp.garmin_error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">⚠️ {sp.garmin_error}</p>}

      <GarminCard status={status} />

      <div className="grid gap-6 lg:grid-cols-2">
        <SummaryCard title="Esta semana" totals={week} />
        <SummaryCard title={`Este mes`} totals={month} />
      </div>

      <section className="card">
        <h2 className="h2">Horas por semana (últimas 8)</h2>
        <div className="flex h-40 items-end gap-2">
          {weekly.map((w) => (
            <div key={w.start} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] text-slate-500">{w.total ? fmtNum(w.total, 1) : ""}</span>
              <div className="flex w-full flex-col-reverse overflow-hidden rounded-t" style={{ height: `${(w.total / maxWeek) * 100}%` }}>
                {SPORT_ORDER.filter((s) => w.bySport.get(s)).map((s) => (
                  <div key={s} className={SPORTS[s].bar} style={{ height: `${((w.bySport.get(s) ?? 0) / w.total) * 100}%` }} title={`${SPORTS[s].label}: ${fmtNum(w.bySport.get(s), 1)} h`} />
                ))}
              </div>
              <span className="text-[10px] text-slate-500">{fmtDate(w.start, { day: "numeric", month: "short" })}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
          {SPORT_ORDER.map((s) => (
            <span key={s} className="flex items-center gap-1"><span className={`inline-block h-2 w-2 rounded-full ${SPORTS[s].bar}`} />{SPORTS[s].label}</span>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="h2 mb-0">Historial</h2>
          <Tabs
            items={[
              { href: "/entrenos", label: "Todos", active: !sport },
              ...SPORT_ORDER.map((s) => ({ href: `/entrenos?deporte=${s}`, label: `${SPORTS[s].icon} ${SPORTS[s].label}`, active: sport === s })),
            ]}
          />
        </div>
        {workouts.length === 0 ? (
          <Empty>{status.connected ? "Aún no hay entrenos. Pulsa «Sincronizar ahora» o añade uno a mano." : "Conecta Garmin o añade un entreno manual."}</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {workouts.map((w) => (
              <li key={w.id}>
                <Link href={`/entrenos/${w.id}`} className="flex items-center gap-3 rounded-lg px-1 py-3 hover:bg-slate-50">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg ${SPORTS[w.sport].badge}`}>{SPORTS[w.sport].icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{w.title}</p>
                    <p className="text-xs text-slate-500">{headline(w)}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p className="capitalize">{fmtDate(w.started_at)}</p>
                    <p>{fmtTime(w.started_at)}{w.rpe ? ` · RPE ${w.rpe}` : ""}{w.source === "garmin" ? " · ⌚" : ""}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {sp.nuevo === "1" && (
        <form id="nuevo" action={saveWorkout} className="card space-y-3">
          <h2 className="h2">Nuevo entreno manual</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Deporte">
              <select className="input" name="sport" defaultValue={sport ?? "gimnasio"}>
                {SPORT_ORDER.map((s) => <option key={s} value={s}>{SPORTS[s].icon} {SPORTS[s].label}</option>)}
              </select>
            </Field>
            <Field label="Título *"><input className="input" name="title" required placeholder="Pierna, rodaje suave…" /></Field>
            <Field label="Fecha y hora *"><input className="input" type="datetime-local" name="started_at" required defaultValue={`${today}T18:00`} /></Field>
            <Field label="Duración (min)"><input className="input" name="duration_min" type="number" step="1" min="0" inputMode="numeric" /></Field>
            <Field label="Distancia (km)"><input className="input" name="distance_km" type="number" step="0.01" min="0" inputMode="decimal" /></Field>
            <Field label="Desnivel (m)"><input className="input" name="elevation_gain_m" type="number" step="1" min="0" /></Field>
            <Field label="FC media"><input className="input" name="avg_hr" type="number" step="1" min="0" /></Field>
            <Field label="Calorías"><input className="input" name="calories" type="number" step="1" min="0" /></Field>
            <Field label="RPE (1–10)"><input className="input" name="rpe" type="number" min="1" max="10" /></Field>
          </div>
          <Field label="Notas"><textarea className="input" name="notes" rows={2} /></Field>
          <div className="flex gap-2">
            <SubmitButton>Guardar y añadir detalles</SubmitButton>
            <Link href="/entrenos" className="btn">Cancelar</Link>
          </div>
        </form>
      )}
    </div>
  );
}

function SummaryCard({ title, totals }: { title: string; totals: Map<Sport, Totals> }) {
  const all = emptyTotals();
  for (const t of totals.values()) { all.sessions += t.sessions; all.seconds += t.seconds; all.meters += t.meters; all.elevation += t.elevation; }
  return (
    <section className="card">
      <div className="flex items-baseline justify-between">
        <h2 className="h2">{title}</h2>
        <span className="text-sm text-slate-600">{all.sessions} sesiones · {fmtDuration(all.seconds)}</span>
      </div>
      {all.sessions === 0 ? (
        <Empty>Sin entrenos</Empty>
      ) : (
        <ul className="space-y-2">
          {SPORT_ORDER.filter((s) => totals.get(s)).map((s) => {
            const t = totals.get(s)!;
            return (
              <li key={s} className="flex items-center gap-3 text-sm">
                <span className={`badge ${SPORTS[s].badge}`}>{SPORTS[s].icon} {SPORTS[s].label}</span>
                <span className="text-slate-600">{t.sessions}×</span>
                <span className="flex-1 text-right text-slate-700">
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
