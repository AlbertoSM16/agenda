import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { eur, fmtDate } from "@/lib/format";
import { PRIORITIES, type ShoppingItem } from "@/lib/types";
import { buyShoppingItem, saveShoppingItem, setShoppingStatus } from "@/lib/actions";
import { Empty, Field, PageHeader } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import DeleteButton from "@/components/DeleteButton";

type SP = Promise<{ edit?: string }>;
const back = "/compras";

export default async function ShoppingPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("shopping_items").select("*").order("created_at", { ascending: false });
  const items = (data ?? []) as ShoppingItem[];
  const editing = sp.edit ? items.find((i) => i.id === sp.edit) ?? null : null;

  const pending = items
    .filter((i) => i.status === "pendiente")
    .sort((a, b) => PRIORITIES[a.priority].order - PRIORITIES[b.priority].order);
  const bought = items.filter((i) => i.status === "comprado").sort((a, b) => (b.purchased_at ?? "").localeCompare(a.purchased_at ?? ""));
  const discarded = items.filter((i) => i.status === "descartado");
  const total = pending.reduce((s, i) => s + Number(i.estimated_price ?? 0), 0);

  return (
    <div>
      <PageHeader title="Lista de compras">
        <span className="text-sm text-slate-600">{pending.length} pendientes · <b>{eur(total)}</b> estimado</span>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <h2 className="h2">Quiero comprar</h2>
            {pending.length === 0 ? (
              <Empty>Tu lista está vacía</Empty>
            ) : (
              <ul className="divide-y divide-slate-100">
                {pending.map((i) => (
                  <li key={i.id} className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`badge ${PRIORITIES[i.priority].color}`}>{PRIORITIES[i.priority].label}</span>
                      <span className="flex-1 font-medium">
                        {i.url ? <a href={i.url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 hover:underline">{i.name} ↗</a> : i.name}
                      </span>
                      {i.estimated_price !== null && <span className="text-sm text-slate-600">{eur(i.estimated_price)}</span>}
                    </div>
                    {i.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{i.notes}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <form action={buyShoppingItem} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-1">
                        <input type="hidden" name="id" value={i.id} />
                        <input type="hidden" name="back" value={back} />
                        <input className="input w-24 py-1" name="price" type="number" step="0.01" min="0" placeholder="Precio" defaultValue={i.estimated_price ?? ""} aria-label="Precio pagado" />
                        <label className="flex items-center gap-1 text-xs text-slate-600">
                          <input type="checkbox" name="register" defaultChecked /> Apuntar gasto
                        </label>
                        <SubmitButton className="btn btn-sm border-emerald-500 text-emerald-700">✓ Comprado</SubmitButton>
                      </form>
                      <Link href={`${back}?edit=${i.id}`} className="btn btn-sm">Editar</Link>
                      <form action={setShoppingStatus}>
                        <input type="hidden" name="id" value={i.id} />
                        <input type="hidden" name="status" value="descartado" />
                        <input type="hidden" name="back" value={back} />
                        <SubmitButton className="btn btn-sm">Descartar</SubmitButton>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {bought.length > 0 && (
            <details className="card">
              <summary className="cursor-pointer font-semibold text-slate-700">Comprado ({bought.length})</summary>
              <ul className="mt-3 divide-y divide-slate-100">
                {bought.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                    <span className="flex-1 text-slate-500 line-through">{i.name}</span>
                    {i.estimated_price !== null && <span className="text-slate-500">{eur(i.estimated_price)}</span>}
                    {i.purchased_at && <span className="text-xs text-slate-400">{fmtDate(i.purchased_at)}</span>}
                    <DeleteButton table="shopping_items" id={i.id} back={back} />
                  </li>
                ))}
              </ul>
            </details>
          )}

          {discarded.length > 0 && (
            <details className="card">
              <summary className="cursor-pointer font-semibold text-slate-700">Descartado ({discarded.length})</summary>
              <ul className="mt-3 divide-y divide-slate-100">
                {discarded.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                    <span className="flex-1 text-slate-500">{i.name}</span>
                    <form action={setShoppingStatus}>
                      <input type="hidden" name="id" value={i.id} />
                      <input type="hidden" name="status" value="pendiente" />
                      <input type="hidden" name="back" value={back} />
                      <SubmitButton className="btn btn-sm">Recuperar</SubmitButton>
                    </form>
                    <DeleteButton table="shopping_items" id={i.id} back={back} />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <form action={saveShoppingItem} className="card h-fit space-y-3 lg:sticky lg:top-8" key={editing?.id ?? "new"}>
          <h2 className="h2">{editing ? "Editar artículo" : "Añadir a la lista"}</h2>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <input type="hidden" name="back" value={back} />
          <Field label="¿Qué quieres comprar? *">
            <input className="input" name="name" required defaultValue={editing?.name} placeholder="Auriculares, libro…" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Precio estimado (€)">
              <input className="input" name="estimated_price" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={editing?.estimated_price ?? ""} />
            </Field>
            <Field label="Prioridad">
              <select className="input" name="priority" defaultValue={editing?.priority ?? "media"}>
                {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Enlace">
            <input className="input" name="url" type="url" defaultValue={editing?.url ?? ""} placeholder="https://…" />
          </Field>
          <Field label="Notas">
            <textarea className="input" name="notes" rows={2} defaultValue={editing?.notes ?? ""} placeholder="Talla, color, tienda…" />
          </Field>
          <div className="flex gap-2">
            <SubmitButton>{editing ? "Guardar cambios" : "Añadir"}</SubmitButton>
            {editing && <Link href={back} className="btn">Cancelar</Link>}
          </div>
        </form>
      </div>
    </div>
  );
}
