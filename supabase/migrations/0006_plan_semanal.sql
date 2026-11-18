-- Planificación semanal de entrenos (un plan por día de la semana).
-- weekday: 0 = lunes … 6 = domingo.
create table public.training_plan (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  weekday    smallint not null check (weekday between 0 and 6),
  sport      text not null default 'gimnasio' check (sport in ('bici', 'carrera', 'gimnasio', 'natacion', 'otro', 'descanso')),
  title      text not null,
  details    text,
  created_at timestamptz not null default now(),
  constraint training_plan_user_day unique (user_id, weekday)
);

alter table public.training_plan enable row level security;
create policy "solo propietario" on public.training_plan
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.training_plan to authenticated;
