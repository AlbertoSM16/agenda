import { dbError } from "@/lib/db";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import type { Note } from "@/lib/types";
import { saveNote } from "@/lib/actions";
import { DbError, Empty, Field, PageHeader } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import DeleteButton from "@/components/DeleteButton";

type SP = Promise<{ q?: string; tag?: string; edit?: string; nueva?: string }>;

export default async function NotesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const tag = sp.tag?.trim().toLowerCase() ?? "";
  const supabase = await createClient();

  let query = supabase.from("notes").select("id,title,content,tags,updated_at").order("updated_at", { ascending: false });
  if (q) query = query.textSearch("fts", q, { type: "websearch", config: "spanish" });
  if (tag) query = query.contains("tags", [tag]);

  const [mainRes, tagsRes, editRes] = await Promise.all([
    query,
    supabase.from("notes").select("tags"),
    sp.edit ? supabase.from("notes").select("*").eq("id", sp.edit).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const notes = (mainRes.data ?? []) as Note[];
  const editing = editRes.data as Note | null;

  const tagCount = new Map<string, number>();
  for (const row of (tagsRes.data ?? []) as { tags: string[] }[]) for (const t of row.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  const allTags = [...tagCount.entries()].sort((a, b) => b[1] - a[1]);

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (tag) params.set("tag", tag);
  const back = `/notas${params.size ? `?${params}` : ""}`;
  const showForm = !!editing || sp.nueva === "1";

  return (
    <div>
      <DbError message={dbError(mainRes, tagsRes, editRes)} />
      <PageHeader title="Notas y conocimiento">
        <Link href={`/notas?nueva=1`} className="btn-primary">+ Nueva nota</Link>
      </PageHeader>

      <form className="mb-4 flex gap-2">
        <input className="input" name="q" defaultValue={q} placeholder="Buscar en tus notas…" />
        {tag && <input type="hidden" name="tag" value={tag} />}
        <button className="btn">Buscar</button>
        {(q || tag) && <Link href="/notas" className="btn">Limpiar</Link>}
      </form>

      {allTags.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-1">
          {allTags.map(([t, n]) => (
            <Link
              key={t}
              href={t === tag ? "/notas" : `/notas?tag=${encodeURIComponent(t)}`}
              className={`badge ${t === tag ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-200 hover:bg-slate-700"}`}
            >
              #{t} <span className="opacity-60">{n}</span>
            </Link>
          ))}
        </div>
      )}

      {showForm && (
        <form action={saveNote} className="card mb-6 flex flex-col gap-3" key={editing?.id ?? "new"}>
          <h2 className="h2">{editing ? "Editar nota" : "Nueva nota"}</h2>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <input type="hidden" name="back" value={back} />
          <Field label="Título *">
            <input className="input" name="title" required defaultValue={editing?.title} autoFocus />
          </Field>
          <Field label="Contenido">
            <textarea className="input font-mono" name="content" rows={12} defaultValue={editing?.content ?? ""} placeholder="Escribe todo lo que quieras recordar…" />
          </Field>
          <Field label="Etiquetas (separadas por comas)">
            <input className="input" name="tags" defaultValue={editing?.tags.join(", ") ?? tag} placeholder="trabajo, ideas, recetas" />
          </Field>
          <div className="flex gap-2">
            <SubmitButton>{editing ? "Guardar cambios" : "Guardar nota"}</SubmitButton>
            <Link href={back} className="btn">Cancelar</Link>
          </div>
        </form>
      )}

      {notes.length === 0 ? (
        <div className="card"><Empty>{q || tag ? "No hay notas que coincidan" : "Aún no tienes notas. ¡Empieza a volcar tu conocimiento!"}</Empty></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {notes.map((n) => (
            <article key={n.id} className="card flex flex-col">
              <Link href={`${back}${back.includes("?") ? "&" : "?"}edit=${n.id}`} className="font-semibold hover:text-indigo-300">
                {n.title}
              </Link>
              <p className="mt-1 line-clamp-6 flex-1 whitespace-pre-wrap text-sm text-slate-300">{n.content}</p>
              <div className="mt-3 flex flex-wrap items-center gap-1">
                {n.tags.map((t) => (
                  <Link key={t} href={`/notas?tag=${encodeURIComponent(t)}`} className="badge bg-slate-800 text-slate-300">#{t}</Link>
                ))}
                <span className="ml-auto text-xs text-slate-500">{fmtDate(n.updated_at.slice(0, 10))}</span>
                <DeleteButton table="notes" id={n.id} back={back} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
