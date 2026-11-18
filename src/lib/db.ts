type Result = { data?: unknown; error?: { message: string; code?: string } | null };

/** Devuelve el primer error de Supabase (y lo deja en los logs) o null. */
export function dbError(...results: Result[]): string | null {
  const err = results.find((r) => r.error)?.error;
  if (!err) return null;
  console.error("Supabase:", err.code ?? "", err.message);
  if (err.code === "42501") {
    return `Supabase ha denegado el acceso (${err.message}). Ejecuta supabase/migrations/0004_grants.sql en el SQL Editor.`;
  }
  if (err.code === "42P01" || err.code === "PGRST205") {
    return `Falta una tabla en Supabase (${err.message}). Ejecuta las migraciones de supabase/migrations en orden.`;
  }
  return `Error al leer de Supabase: ${err.message}`;
}
