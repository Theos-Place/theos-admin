-- FIN-11 · La liquidación del viaje (ANX-03), fase B.
--
-- Al volver: qué se gastó de verdad, contra qué anticipo, y quién le debe a
-- quién. La cuenta es POR MONEDA y se calcula en `lib/travel/liquidacion`,
-- que tiene los tests; acá no se guarda ningún total — un total guardado se
-- desalinea de sus líneas y nadie se entera hasta que finanzas concilia.

alter table public.travel_requests
  -- Lo que de verdad se entregó, que puede no ser lo que se pidió.
  add column if not exists anticipo_recibido_monto numeric,
  add column if not exists anticipo_recibido_moneda text,
  add column if not exists anticipo_entregado_at timestamptz,
  -- La declaración jurada del anexo: quién firmó y cuándo. Un booleano solo
  -- no sirve de nada dentro de seis meses.
  add column if not exists declaracion_jurada_at timestamptz,
  add column if not exists declaracion_jurada_por uuid references public.members(id) on delete set null,
  add column if not exists liquidacion_enviada_at timestamptz,
  add column if not exists notas_liquidacion text;

alter table public.travel_requests
  drop constraint if exists travel_requests_anticipo_recibido_moneda_check;
alter table public.travel_requests
  add constraint travel_requests_anticipo_recibido_moneda_check check (
    anticipo_recibido_moneda is null or anticipo_recibido_moneda in ('CRC','USD'));

-- Un anticipo recibido sin moneda es un número sin unidad, y con esa plata
-- alguien ya compró pasajes.
alter table public.travel_requests
  drop constraint if exists travel_requests_anticipo_recibido_check;
alter table public.travel_requests
  add constraint travel_requests_anticipo_recibido_check check (
    anticipo_recibido_monto is null
    or (anticipo_recibido_monto >= 0 and anticipo_recibido_moneda is not null));

-- ANX-03 · los gastos ejecutados, uno por comprobante.
create table if not exists public.travel_expenses (
  id uuid primary key default gen_random_uuid(),
  travel_request_id uuid not null references public.travel_requests(id) on delete cascade,
  fecha date not null,
  rubro text not null,
  proveedor text,
  numero_comprobante text,
  monto numeric not null,
  moneda text not null,
  -- El archivo vive en el bucket privado `payment-receipts`, bajo `viajes/`.
  -- No se crea un bucket nuevo a propósito: es el mismo tipo de contenido
  -- —un comprobante privado— y un bucket más es un paso de operación más que
  -- hay que acordarse de hacer en cada ambiente.
  receipt_path text,
  -- La excepción del reglamento para lo que no da factura (un taxi, un
  -- parqueo de barrio). Escrita y visible, en vez de escondida en un monto.
  sin_comprobante_motivo text,
  orden integer not null default 0,
  created_at timestamptz not null default now(),

  constraint travel_expenses_rubro_check check (rubro in (
    'pasajes','transporte_local','hospedaje','alimentacion','inscripcion',
    'seguro','peajes','combustible','km','otros')),
  constraint travel_expenses_moneda_check check (moneda in ('CRC','USD')),
  constraint travel_expenses_monto_check check (monto > 0),
  -- O hay comprobante, o hay una razón escrita de por qué no. Las dos juntas
  -- se permiten (un comprobante ilegible con su nota); ninguna de las dos, no.
  constraint travel_expenses_respaldo_check check (
    receipt_path is not null or coalesce(btrim(sin_comprobante_motivo), '') <> '')
);

create index if not exists travel_expenses_request_idx
  on public.travel_expenses (travel_request_id, orden);

alter table public.travel_expenses enable row level security;
