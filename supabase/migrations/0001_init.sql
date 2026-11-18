-- Agenda personal: esquema inicial.
-- Ejecuta este fichero entero en Supabase → SQL Editor.
-- Cada fila pertenece a un usuario (user_id) y RLS impide ver datos ajenos.

-- Las fechas/horas de eventos se guardan como "hora local" (timestamp sin zona),
-- que es lo natural para una agenda personal en una sola zona horaria.

create table public.events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  title       text not null,
  type        text not null default 'evento' check (type in ('reunion', 'evento', 'cita', 'otro')),
  starts_at   timestamp not null,
  ends_at     timestamp,
  location    text,
  attendees   text,
  description text,
  notes       text, -- actas / apuntes de la reunión
  created_at  timestamptz not null default now()
);
create index events_user_start_idx on public.events (user_id, starts_at);

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  title        text not null,
  description  text,
  due_date     date,
  priority     text not null default 'media' check (priority in ('baja', 'media', 'alta')),
  status       text not null default 'pendiente' check (status in ('pendiente', 'en_curso', 'hecha')),
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);
create index tasks_user_status_idx on public.tasks (user_id, status, due_date);

create table public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  title      text not null,
  content    text,
  tags       text[] not null default '{}',
  fts        tsvector generated always as (
               to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(content, ''))
             ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_fts_idx on public.notes using gin (fts);
create index notes_tags_idx on public.notes using gin (tags);
create index notes_user_idx on public.notes (user_id, updated_at desc);

create table public.transactions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  kind           text not null check (kind in ('gasto', 'ingreso')),
  amount         numeric(12, 2) not null check (amount > 0),
  category       text not null default 'Otros',
  description    text,
  date           date not null default current_date,
  payment_method text,
  created_at     timestamptz not null default now()
);
create index transactions_user_date_idx on public.transactions (user_id, date desc);

create table public.shopping_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users on delete cascade,
  name            text not null,
  estimated_price numeric(12, 2) check (estimated_price >= 0),
  priority        text not null default 'media' check (priority in ('baja', 'media', 'alta')),
  url             text,
  notes           text,
  status          text not null default 'pendiente' check (status in ('pendiente', 'comprado', 'descartado')),
  purchased_at    date,
  created_at      timestamptz not null default now()
);
create index shopping_user_status_idx on public.shopping_items (user_id, status);

-- Row Level Security: cada usuario solo ve y modifica sus propias filas.
alter table public.events         enable row level security;
alter table public.tasks          enable row level security;
alter table public.notes          enable row level security;
alter table public.transactions   enable row level security;
alter table public.shopping_items enable row level security;

create policy "solo propietario" on public.events
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "solo propietario" on public.tasks
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "solo propietario" on public.notes
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "solo propietario" on public.transactions
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "solo propietario" on public.shopping_items
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
