import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, todayISO } from "@/lib/format";
import { PRIORITIES, type Task } from "@/lib/types";
import { saveTask, toggleTask } from "@/lib/actions";
import { Empty, Field, PageHeader, Tabs } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import DeleteButton from "@/components/DeleteButton";

type SP = Promise<{ ver?: string; edit?: string }>;

const STATUS_LABEL: Record<Task["status"], string> = { pendiente: "Pendiente", en_curso: "En curso", hecha: "Hecha" };

export default async function TasksPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const ver = sp.ver === "hechas" || sp.ver === "todas" ? sp.ver : "pendientes";
  const today = todayISO();
  const supabase = await createClient();

  let query = supabase.from("tasks").select("*");
  if (ver === "pendientes") query = query.neq("status", "hecha");
  if (ver === "hechas") query = query.eq("status", "hecha");
  query = ver === "hechas"
    ? query.order("completed_at", { ascending: false }).limit(200)
    : query.order("due_date", { ascending: true, nullsFirst: false });

  const [{ data }, editRes] = await Promise.all([
    query,
    sp.edit ? supabase.from("tasks").select("*").eq("id", sp.edit).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const tasks = (data ?? []) as Task[];
  if (ver !== "hechas") {
    tasks.sort((a, b) =>
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || PRIORITIES[a.priority].order - PRIORITIES[b.priority].order,
    );
  }
  const editing = editRes.data as Task | null;
  const back = `/tareas?ver=${ver}`;

  return (
    <div>
      <PageHeader title="Tareas">
        <Tabs
          items={[
            { href: "/tareas?ver=pendientes", label: "Pendientes", active: ver === "pendientes" },
            { href: "/tareas?ver=hechas", label: "Hechas", active: ver === "hechas" },
            { href: "/tareas?ver=todas", label: "Todas", active: ver === "todas" },
          ]}
        />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          {tasks.length === 0 ? (
            <Empty>No hay tareas aquí</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {tasks.map((t) => {
                const done = t.status === "hecha";
                const overdue = !done && t.due_date !== null && t.due_date < today;
                return (
                  <li key={t.id} className="flex flex-wrap items-start gap-3 py-3">
                    <form action={toggleTask}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="done" value={done ? "0" : "1"} />
                      <input type="hidden" name="back" value={back} />
                      <button
                        className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded border text-xs ${
                          done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-400 hover:bg-emerald-100"
                        }`}
                        title={done ? "Marcar como pendiente" : "Marcar como hecha"}
                      >
                        {done && "✓"}
                      </button>
                    </form>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${done ? "text-slate-400 line-through" : ""}`}>{t.title}</p>
                      {t.description && <p className="whitespace-pre-wrap text-xs text-slate-500">{t.description}</p>}
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className={`badge ${PRIORITIES[t.priority].color}`}>{PRIORITIES[t.priority].label}</span>
                        {t.status === "en_curso" && <span className="badge bg-sky-100 text-sky-700">En curso</span>}
                        {t.due_date && (
                          <span className={`badge ${overdue ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                            {overdue ? "Vencida · " : ""}{t.due_date === today ? "Hoy" : fmtDate(t.due_date)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Link href={`${back}&edit=${t.id}`} className="btn btn-sm">Editar</Link>
                      <DeleteButton table="tasks" id={t.id} back={back} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <form action={saveTask} className="card h-fit space-y-3 lg:sticky lg:top-8" key={editing?.id ?? "new"}>
          <h2 className="h2">{editing ? "Editar tarea" : "Nueva tarea"}</h2>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <input type="hidden" name="back" value={back} />
          <Field label="Título *">
            <input className="input" name="title" required defaultValue={editing?.title} placeholder="¿Qué hay que hacer?" />
          </Field>
          <Field label="Descripción">
            <textarea className="input" name="description" rows={3} defaultValue={editing?.description ?? ""} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Fecha límite">
              <input className="input" type="date" name="due_date" defaultValue={editing?.due_date ?? ""} />
            </Field>
            <Field label="Prioridad">
              <select className="input" name="priority" defaultValue={editing?.priority ?? "media"}>
                {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Estado">
            <select className="input" name="status" defaultValue={editing?.status ?? "pendiente"}>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <div className="flex gap-2">
            <SubmitButton>{editing ? "Guardar cambios" : "Añadir tarea"}</SubmitButton>
            {editing && <Link href={back} className="btn">Cancelar</Link>}
          </div>
        </form>
      </div>
    </div>
  );
}
