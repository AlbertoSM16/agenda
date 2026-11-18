import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addMonths, fmtDate, fmtTime, isYearMonth, monthLabel, toInputDT, todayISO } from "@/lib/format";
import { EVENT_TYPES, type AgendaEvent } from "@/lib/types";
import { saveEvent } from "@/lib/actions";
import { Empty, Field, PageHeader } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import DeleteButton from "@/components/DeleteButton";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

type SP = Promise<{ month?: string; day?: string; edit?: string }>;

export default async function CalendarPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const today = todayISO();
  const ym = isYearMonth(sp.month) ? sp.month : (sp.day ?? today).slice(0, 7);
  const supabase = await createClient();

  const [{ data }, editRes] = await Promise.all([
    supabase.from("events").select("*").gte("starts_at", `${ym}-01`).lt("starts_at", `${addMonths(ym, 1)}-01`).order("starts_at"),
    sp.edit ? supabase.from("events").select("*").eq("id", sp.edit).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const events = (data ?? []) as AgendaEvent[];
  const editing = editRes.data as AgendaEvent | null;

  const byDay = new Map<string, AgendaEvent[]>();
  for (const e of events) {
    const d = e.starts_at.slice(0, 10);
    byDay.set(d, [...(byDay.get(d) ?? []), e]);
  }

  const [y, m] = ym.split("-").map(Number);
  const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`),
  ];
  while (cells.length % 7) cells.push(null);

  const back = `/calendario?month=${ym}`;
  const day = sp.day ?? (ym === today.slice(0, 7) ? today : `${ym}-01`);

  return (
    <div>
      <PageHeader title="Calendario">
        <Link href={`/calendario?month=${addMonths(ym, -1)}`} className="btn">←</Link>
        <span className="min-w-36 text-center font-medium capitalize">{monthLabel(ym)}</span>
        <Link href={`/calendario?month=${addMonths(ym, 1)}`} className="btn">→</Link>
        <Link href="/calendario" className="btn">Hoy</Link>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card p-2 sm:p-4">
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500">
              {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) =>
                d === null ? (
                  <div key={i} />
                ) : (
                  <div
                    key={d}
                    className={`min-h-16 rounded-lg border p-1 sm:min-h-24 ${
                      d === today ? "border-indigo-400 bg-indigo-50" : d === sp.day ? "border-indigo-300" : "border-slate-100"
                    }`}
                  >
                    <Link href={`/calendario?month=${ym}&day=${d}`} className="block text-xs font-medium text-slate-600 hover:text-indigo-600" title="Nuevo evento este día">
                      {Number(d.slice(8))}
                    </Link>
                    <div className="mt-0.5 space-y-0.5">
                      {(byDay.get(d) ?? []).map((e) => (
                        <Link
                          key={e.id}
                          href={`/calendario?month=${ym}&edit=${e.id}`}
                          className={`block truncate rounded px-1 text-[10px] sm:text-xs ${EVENT_TYPES[e.type].color}`}
                          title={e.title}
                        >
                          <span className="hidden sm:inline">{fmtTime(e.starts_at)} </span>{e.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>

          <section className="card">
            <h2 className="h2">Eventos de {monthLabel(ym)}</h2>
            {events.length === 0 ? (
              <Empty>No hay eventos este mes</Empty>
            ) : (
              <ul className="divide-y divide-slate-100">
                {events.map((e) => (
                  <li key={e.id} className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-28 text-xs capitalize text-slate-500">
                        {fmtDate(e.starts_at)} · {fmtTime(e.starts_at)}
                      </span>
                      <span className="flex-1 font-medium">{e.title}</span>
                      <span className={`badge ${EVENT_TYPES[e.type].color}`}>{EVENT_TYPES[e.type].label}</span>
                      <Link href={`${back}&edit=${e.id}`} className="btn btn-sm">Editar</Link>
                      <DeleteButton table="events" id={e.id} back={back} />
                    </div>
                    {(e.location || e.attendees) && (
                      <p className="mt-1 text-xs text-slate-500">
                        {e.location && <>📍 {e.location} </>}
                        {e.attendees && <>👥 {e.attendees}</>}
                      </p>
                    )}
                    {e.description && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{e.description}</p>}
                    {e.notes && (
                      <details className="mt-1 text-sm">
                        <summary className="cursor-pointer text-xs text-indigo-600">Ver notas / acta</summary>
                        <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-2">{e.notes}</p>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <form action={saveEvent} className="card h-fit space-y-3 lg:sticky lg:top-8" key={editing?.id ?? day}>
          <h2 className="h2">{editing ? "Editar evento" : `Nuevo evento · ${fmtDate(day)}`}</h2>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <input type="hidden" name="back" value={back} />
          <Field label="Título *">
            <input className="input" name="title" required defaultValue={editing?.title} placeholder="Reunión con…" />
          </Field>
          <Field label="Tipo">
            <select className="input" name="type" defaultValue={editing?.type ?? "reunion"}>
              {Object.entries(EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Inicio *">
              <input className="input" type="datetime-local" name="starts_at" required defaultValue={editing ? toInputDT(editing.starts_at) : `${day}T09:00`} />
            </Field>
            <Field label="Fin">
              <input className="input" type="datetime-local" name="ends_at" defaultValue={toInputDT(editing?.ends_at)} />
            </Field>
          </div>
          <Field label="Lugar">
            <input className="input" name="location" defaultValue={editing?.location ?? ""} placeholder="Oficina, Zoom…" />
          </Field>
          <Field label="Asistentes">
            <input className="input" name="attendees" defaultValue={editing?.attendees ?? ""} placeholder="Ana, Luis…" />
          </Field>
          <Field label="Descripción">
            <textarea className="input" name="description" rows={2} defaultValue={editing?.description ?? ""} />
          </Field>
          <Field label="Notas / acta de la reunión">
            <textarea className="input" name="notes" rows={5} defaultValue={editing?.notes ?? ""} placeholder="Qué se habló, acuerdos, próximos pasos…" />
          </Field>
          <div className="flex gap-2">
            <SubmitButton>{editing ? "Guardar cambios" : "Añadir evento"}</SubmitButton>
            {editing && <Link href={back} className="btn">Cancelar</Link>}
          </div>
        </form>
      </div>
    </div>
  );
}
