// Helpers para leer FormData en las Server Actions.

export function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  const t = typeof v === "string" ? v.trim() : "";
  return t === "" ? null : t;
}

export function num(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (v === null) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Ruta a la que volver tras la acción: solo rutas internas. */
export function back(fd: FormData, fallback: string) {
  const b = str(fd, "back");
  return b && b.startsWith("/") && !b.startsWith("//") ? b : fallback;
}

export function required<T>(value: T | null, name: string): T {
  if (value === null) throw new Error(`Falta el campo obligatorio: ${name}`);
  return value;
}

export function withParam(path: string, param: string | null) {
  if (!param) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${param}`;
}
