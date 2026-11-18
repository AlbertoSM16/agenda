-- Añade "ahorro" como tercer tipo de movimiento (además de gasto e ingreso).
alter table public.transactions drop constraint if exists transactions_kind_check;
alter table public.transactions
  add constraint transactions_kind_check check (kind in ('gasto', 'ingreso', 'ahorro'));
