-- FIN-12 · Adelantos de comida por sede (reemplaza los Excels mensuales).
--
-- Cada sede recibe un adelanto mensual con presupuesto; el Colaborador de
-- Finanzas de la sede registra las facturas de cada semana (por fecha de
-- charla, con el encargado de esa semana) y el sistema resta en vivo. Al
-- cerrar el mes queda el saldo final, que es lo que finanzas repone.
--
-- Se modela como lo hacía el Excel de Liberia que pasó Floriana: la unidad
-- es la SEMANA (fecha de charla + encargado), y las facturas llevan proveedor,
-- número de factura electrónica, monto, estado (pendiente/liquidada) y
-- observaciones. La hoja de DONACIONES de ese Excel NO entra acá: se confirma
-- con Meli antes (ver docs/plan-desarrollo.md, FIN-12).

-- El presupuesto por sede: lo fija finanzas y se puede cambiar. El adelanto de
-- cada mes COPIA el valor vigente al abrirse (ver `presupuesto` abajo), para
-- que subir el presupuesto en noviembre no reescriba el saldo de octubre.
create table if not exists public.sede_advance_budgets (
  sede_code text primary key references public.sedes(code) on delete cascade,
  monto numeric not null check (monto >= 0),
  moneda text not null default 'CRC' check (moneda in ('CRC','USD')),
  updated_by uuid references public.members(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.sede_advances (
  id uuid primary key default gen_random_uuid(),
  sede_code text not null references public.sedes(code) on delete cascade,
  -- 'YYYY-MM'. Texto y no date: un mes no es un día, y guardarlo como el 1°
  -- invita a restar fechas que no significan nada.
  mes text not null check (mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  presupuesto numeric not null check (presupuesto >= 0),
  moneda text not null default 'CRC' check (moneda in ('CRC','USD')),
  estado text not null default 'abierto' check (estado in ('abierto','cerrado')),
  -- Al cerrar: lo que quedó (puede ser negativo = sobregiro). Se guarda
  -- porque es el número que decide la reposición y no debe recalcularse si
  -- después alguien toca una factura.
  saldo_final numeric,
  cerrado_por uuid references public.members(id) on delete set null,
  cerrado_at timestamptz,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sede_code, mes)
);

create table if not exists public.sede_advance_expenses (
  id uuid primary key default gen_random_uuid(),
  advance_id uuid not null references public.sede_advances(id) on delete cascade,
  -- La semana a la que pertenece: la fecha de la CHARLA, como en el Excel.
  semana date not null,
  encargado text,
  fecha date not null,
  proveedor text not null,
  numero_factura text,
  monto numeric not null check (monto > 0),
  estado text not null default 'liquidada' check (estado in ('pendiente','liquidada')),
  observaciones text,
  -- Foto de la factura, en el bucket privado `payment-receipts` bajo
  -- `adelantos/`. Mismo criterio que viáticos: no se crea un bucket nuevo.
  receipt_path text,
  registrado_por uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sede_advances_sede_mes_idx on public.sede_advances (sede_code, mes desc);
create index if not exists sede_advance_expenses_advance_idx on public.sede_advance_expenses (advance_id, semana, fecha);

-- RLS prendida y sin políticas: todo pasa por el servidor (SEC-3).
alter table public.sede_advance_budgets enable row level security;
alter table public.sede_advances enable row level security;
alter table public.sede_advance_expenses enable row level security;

create trigger set_updated_at_sede_advances before update on public.sede_advances
  for each row execute function public.set_updated_at();
create trigger set_updated_at_sede_advance_expenses before update on public.sede_advance_expenses
  for each row execute function public.set_updated_at();

-- El rol que sincroniza el puesto «Colaborador Finanzas» de cada sede. El
-- CHECK de member_roles enumera los roles: sin esto el sync falla en silencio
-- (gotcha documentado en la memoria del proyecto).
do $$
declare
  def text;
begin
  select pg_get_constraintdef(oid) into def
    from pg_constraint where conrelid = 'public.member_roles'::regclass and contype = 'c' and conname = 'member_roles_role_check';
  if def is not null and def not like '%colaborador_finanzas%' then
    execute 'alter table public.member_roles drop constraint member_roles_role_check';
    execute 'alter table public.member_roles add constraint member_roles_role_check ' ||
      replace(def, ']))', ', ''colaborador_finanzas''::text]))');
  end if;
end $$;
