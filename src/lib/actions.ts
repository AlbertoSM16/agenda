"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { todayISO } from "./format";

const TABLES = ["events", "tasks", "notes", "transactions", "shopping_items"] as const;
type Table = (typeof TABLES)[number];

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  const t = typeof v === "string" ? v.trim() : "";
  return t === "" ? null : t;
}

function num(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (v === null) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Ruta a la que volver tras la acción: solo rutas internas. */
function back(fd: FormData, fallback: string) {
  const b = str(fd, "back");
  return b && b.startsWith("/") && !b.startsWith("//") ? b : fallback;
}

function required<T>(value: T | null, name: string): T {
  if (value === null) throw new Error(`Falta el campo obligatorio: ${name}`);
  return value;
}

async function save(table: Table, fd: FormData, data: Record<string, unknown>, fallback: string) {
  const supabase = await createClient();
  const id = str(fd, "id");
  const { error } = id
    ? await supabase.from(table).update(data).eq("id", id)
    : await supabase.from(table).insert(data);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect(back(fd, fallback));
}

// ---------- Auth ----------

export async function login(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: str(fd, "email") ?? "",
    password: (fd.get("password") as string) ?? "",
  });
  if (error) redirect("/login?error=1");
  revalidatePath("/", "layout");
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------- Eventos ----------

export async function saveEvent(fd: FormData) {
  await save("events", fd, {
    title: required(str(fd, "title"), "título"),
    type: str(fd, "type") ?? "evento",
    starts_at: required(str(fd, "starts_at"), "inicio"),
    ends_at: str(fd, "ends_at"),
    location: str(fd, "location"),
    attendees: str(fd, "attendees"),
    description: str(fd, "description"),
    notes: str(fd, "notes"),
  }, "/calendario");
}

// ---------- Tareas ----------

export async function saveTask(fd: FormData) {
  const status = str(fd, "status") ?? "pendiente";
  await save("tasks", fd, {
    title: required(str(fd, "title"), "título"),
    description: str(fd, "description"),
    due_date: str(fd, "due_date"),
    priority: str(fd, "priority") ?? "media",
    status,
    completed_at: status === "hecha" ? new Date().toISOString() : null,
  }, "/tareas");
}

export async function toggleTask(fd: FormData) {
  const supabase = await createClient();
  const done = str(fd, "done") === "1";
  const { error } = await supabase
    .from("tasks")
    .update({ status: done ? "hecha" : "pendiente", completed_at: done ? new Date().toISOString() : null })
    .eq("id", required(str(fd, "id"), "id"));
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect(back(fd, "/tareas"));
}

// ---------- Notas ----------

export async function saveNote(fd: FormData) {
  const tags = Array.from(new Set(
    (str(fd, "tags") ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
  ));
  await save("notes", fd, {
    title: required(str(fd, "title"), "título"),
    content: str(fd, "content"),
    tags,
    updated_at: new Date().toISOString(),
  }, "/notas");
}

// ---------- Finanzas ----------

export async function saveTransaction(fd: FormData) {
  const amount = required(num(fd, "amount"), "importe");
  if (amount <= 0) throw new Error("El importe debe ser mayor que 0");
  await save("transactions", fd, {
    kind: str(fd, "kind") === "ingreso" ? "ingreso" : "gasto",
    amount,
    category: str(fd, "category") ?? "Otros",
    description: str(fd, "description"),
    date: str(fd, "date") ?? todayISO(),
    payment_method: str(fd, "payment_method"),
  }, "/finanzas");
}

// ---------- Compras ----------

export async function saveShoppingItem(fd: FormData) {
  await save("shopping_items", fd, {
    name: required(str(fd, "name"), "nombre"),
    estimated_price: num(fd, "estimated_price"),
    priority: str(fd, "priority") ?? "media",
    url: str(fd, "url"),
    notes: str(fd, "notes"),
  }, "/compras");
}

export async function buyShoppingItem(fd: FormData) {
  const supabase = await createClient();
  const id = required(str(fd, "id"), "id");
  const price = num(fd, "price");
  const today = todayISO();

  const { data: item, error } = await supabase
    .from("shopping_items")
    .update({ status: "comprado", purchased_at: today, ...(price !== null ? { estimated_price: price } : {}) })
    .eq("id", id)
    .select("name")
    .single();
  if (error) throw new Error(error.message);

  if (fd.get("register") === "on" && price !== null && price > 0) {
    const { error: txError } = await supabase.from("transactions").insert({
      kind: "gasto",
      amount: price,
      category: str(fd, "category") ?? "Compras",
      description: item.name,
      date: today,
    });
    if (txError) throw new Error(txError.message);
  }
  revalidatePath("/", "layout");
  redirect(back(fd, "/compras"));
}

export async function setShoppingStatus(fd: FormData) {
  const supabase = await createClient();
  const status = str(fd, "status");
  if (status !== "pendiente" && status !== "descartado") throw new Error("Estado no válido");
  const { error } = await supabase
    .from("shopping_items")
    .update({ status, purchased_at: null })
    .eq("id", required(str(fd, "id"), "id"));
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect(back(fd, "/compras"));
}

// ---------- Genérico ----------

export async function deleteRow(fd: FormData) {
  const table = str(fd, "table") as Table | null;
  if (!table || !TABLES.includes(table)) throw new Error("Tabla no válida");
  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq("id", required(str(fd, "id"), "id"));
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect(back(fd, "/"));
}
