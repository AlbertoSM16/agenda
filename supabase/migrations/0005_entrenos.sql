-- Entrenamientos y conexión con Garmin Connect.
-- Ejecuta este fichero en Supabase → SQL Editor (después de 0001–0004).

-- Cuenta de Garmin conectada. Los tokens van cifrados (AES-256-GCM con GARMIN_TOKEN_KEY);
-- la contraseña de Garmin nunca se guarda.
create table public.garmin_accounts (
  user_id        uuid primary key default auth.uid() references auth.users on delete cascade,
  display_name   text,
  tokens_enc     text,          -- null mientras el login está a medias (pendiente de MFA)
  mfa_state_enc  text,
  mfa_expires_at timestamptz,
  last_sync_at   timestamptz,
  last_error     text,
  created_at     timestamptz not null default now()
);

create table public.workouts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users on delete cascade,
  garmin_activity_id bigint,
  source             text not null default 'manual' check (source in ('garmin', 'manual')),
  sport              text not null default 'otro' check (sport in ('bici', 'carrera', 'gimnasio', 'natacion', 'otro')),
  garmin_type        text,
  title              text not null,
  started_at         timestamp not null,   -- hora local
  duration_s         numeric,
  moving_s           numeric,
  distance_m         numeric,
  elevation_gain_m   numeric,
  avg_hr             numeric,
  max_hr             numeric,
  avg_speed_mps      numeric,
  max_speed_mps      numeric,
  calories           numeric,
  avg_power          numeric,
  norm_power         numeric,
  avg_cadence        numeric,
  pool_length_m      numeric,
  avg_swolf          numeric,
  strokes            numeric,
  aerobic_te         numeric,
  anaerobic_te       numeric,
  training_load      numeric,
  vo2max             numeric,
  laps               jsonb,
  rpe                smallint check (rpe between 1 and 10),
  notes              text,
  raw                jsonb,
  created_at         timestamptz not null default now(),
  constraint workouts_user_garmin_key unique (user_id, garmin_activity_id)
);
create index workouts_user_start_idx on public.workouts (user_id, started_at desc);

create table public.exercises (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  name         text not null,
  muscle_group text,
  garmin_key   text,
  created_at   timestamptz not null default now(),
  constraint exercises_user_garmin_key unique (user_id, garmin_key)
);
create unique index exercises_user_name_uidx on public.exercises (user_id, lower(name));

create table public.workout_sets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  workout_id  uuid not null references public.workouts on delete cascade,
  exercise_id uuid not null references public.exercises on delete cascade,
  set_index   integer not null,
  reps        integer,
  weight_kg   numeric(6, 2),
  duration_s  numeric,
  is_warmup   boolean not null default false,
  source      text not null default 'manual' check (source in ('garmin', 'manual')),
  created_at  timestamptz not null default now()
);
create index workout_sets_workout_idx on public.workout_sets (workout_id, set_index);
create index workout_sets_exercise_idx on public.workout_sets (exercise_id);

alter table public.garmin_accounts enable row level security;
alter table public.workouts        enable row level security;
alter table public.exercises       enable row level security;
alter table public.workout_sets    enable row level security;

create policy "solo propietario" on public.garmin_accounts
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "solo propietario" on public.workouts
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "solo propietario" on public.exercises
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "solo propietario" on public.workout_sets
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on
  public.garmin_accounts, public.workouts, public.exercises, public.workout_sets
to authenticated;
