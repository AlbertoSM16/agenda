-- Sincronización con Google Calendar.
-- Ejecuta este fichero en Supabase → SQL Editor (después de 0001_init.sql).

-- Cuenta de Google conectada (una por usuario).
create table public.google_accounts (
  user_id       uuid primary key default auth.uid() references auth.users on delete cascade,
  email         text,
  refresh_token text not null,
  calendar_id   text not null default 'primary',
  created_at    timestamptz not null default now()
);

alter table public.google_accounts enable row level security;
create policy "solo propietario" on public.google_accounts
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Enlace de cada evento con su copia en Google y el aviso elegido.
--   reminder_minutes: null = aviso predeterminado de Google, -1 = sin aviso, n >= 0 = n minutos antes.
alter table public.events
  add column google_event_id  text,
  add column reminder_minutes integer check (reminder_minutes >= -1);
