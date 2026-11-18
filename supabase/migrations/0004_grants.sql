-- Permisos de la Data API para usuarios con sesión iniciada.
-- Los proyectos nuevos de Supabase no exponen automáticamente las tablas creadas por SQL,
-- así que hay que conceder los permisos explícitamente. RLS sigue limitando cada fila a su dueño.
-- "anon" (sin sesión) no recibe ningún permiso.

grant usage on schema public to authenticated;

grant select, insert, update, delete on
  public.events,
  public.tasks,
  public.notes,
  public.transactions,
  public.shopping_items,
  public.google_accounts
to authenticated;
