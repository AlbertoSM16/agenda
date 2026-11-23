-- Gastos fijos (alquiler, gimnasio, suscripciones…): se apuntan solos cada mes.
-- La app crea el movimiento del mes al abrir Finanzas o el Resumen, a partir del día de cobro.
-- last_month = último mes ya generado; así, si borras un movimiento generado, no vuelve a aparecer.
create table public.recurring_transactions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  kind           text not null default 'gasto' check (kind in ('gasto', 'ingreso', 'ahorro')),
  amount         numeric(12, 2) not null check (amount > 0),
  category       text not null default 'Otros',
  description    text not null,
  payment_method text,
  day_of_month   smallint not null default 1 check (day_of_month between 1 and 31),
  start_month    date not null default date_trunc('month', current_date)::date,
  last_month     date,
  created_at     timestamptz not null default now()
);

alter table public.recurring_transactions enable row level security;
create policy "solo propietario" on public.recurring_transactions
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.recurring_transactions to authenticated;

-- Enlace del movimiento con su gasto fijo (evita duplicados si se abren dos páginas a la vez).
alter table public.transactions
  add column recurring_id uuid references public.recurring_transactions on delete set null;
-- (Los movimientos normales tienen recurring_id null y no chocan entre sí.)
alter table public.transactions
  add constraint transactions_recurring_date unique (recurring_id, date);

-- Gastos fijos iniciales: gimnasio y alquiler, el día 1 de cada mes desde diciembre de 2026.
-- (La app es de un solo usuario: se asignan al único usuario que existe.)
insert into public.recurring_transactions (user_id, kind, amount, category, description, payment_method, day_of_month, start_month)
select u.id, v.kind, v.amount, v.category, v.description, v.payment_method, v.day_of_month, date '2026-12-01'
from (select id from auth.users order by created_at limit 1) u,
     (values ('gasto', 36.99, 'Salud',   'Gimnasio', 'Domiciliación', 1),
             ('gasto', 280.00, 'Vivienda', 'Alquiler', 'Transferencia', 1))
       as v(kind, amount, category, description, payment_method, day_of_month);
