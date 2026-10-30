-- FIN-16 · De «Adelantos de comida» a «Presupuestos de sedes».
--
-- Decidido con Meli: el piloto de comida (FIN-12) se generaliza a varios TIPOS
-- de presupuesto por sede (comida, bienvenida, desechables, ideas
-- especiales…), con un catálogo que administra finanzas. Cada tipo tiene su
-- presupuesto mensual por sede y su propio mes abierto/cerrado.
--
-- Y el mes deja de ser un solo número: es el SALDO DEL MES ANTERIOR más el
-- DEPÓSITO del mes (pedido de Andrés: así queda claro por qué se depositó
-- menos cuando sobró). `presupuesto` sigue existiendo y es la suma de los dos,
-- para que el saldo y el cierre no cambien.
--
-- Lo que hay al 2026-10-30 en producción —dos presupuestos y un mes abierto
-- de Antares con una factura— queda como tipo «comida».

create table if not exists public.sede_budget_types (
  code text primary key check (code ~ '^[a-z0-9_]+$'),
  nombre text not null,
  -- Puestos (título normalizado: minúsculas, sin tildes ni «de/del») que ven
  -- este tipo. Vacío = todos los puestos con el rol de la sede.
  puestos text[] not null default '{}',
  activo boolean not null default true,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

insert into public.sede_budget_types (code, nombre, orden) values
  ('comida', 'Comida', 1),
  ('bienvenida', 'Bienvenida', 2),
  ('desechables', 'Desechables', 3),
  ('especiales', 'Ideas especiales', 4)
on conflict (code) do nothing;

alter table public.sede_budget_types enable row level security;
grant select, insert, update, delete on public.sede_budget_types to service_role;

-- Presupuesto mensual: ahora por sede Y tipo.
alter table public.sede_advance_budgets
  add column if not exists tipo text not null default 'comida'
  references public.sede_budget_types(code) on update cascade;
alter table public.sede_advance_budgets drop constraint if exists sede_advance_budgets_pkey;
alter table public.sede_advance_budgets add constraint sede_advance_budgets_pkey primary key (sede_code, tipo);

-- El mes: por sede, tipo y mes; con saldo anterior y depósito.
alter table public.sede_advances
  add column if not exists tipo text not null default 'comida'
  references public.sede_budget_types(code) on update cascade;
alter table public.sede_advances add column if not exists deposito numeric check (deposito >= 0);
alter table public.sede_advances add column if not exists saldo_anterior numeric not null default 0 check (saldo_anterior >= 0);
update public.sede_advances set deposito = presupuesto where deposito is null;
alter table public.sede_advances alter column deposito set not null;
alter table public.sede_advances alter column deposito set default 0;

alter table public.sede_advances drop constraint if exists sede_advances_sede_code_mes_key;
alter table public.sede_advances add constraint sede_advances_sede_tipo_mes_key unique (sede_code, tipo, mes);
drop index if exists public.sede_advances_sede_mes_idx;
create index if not exists sede_advances_sede_tipo_mes_idx on public.sede_advances (sede_code, tipo, mes desc);
