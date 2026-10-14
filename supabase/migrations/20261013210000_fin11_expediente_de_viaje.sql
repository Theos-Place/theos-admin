-- FIN-11 · Viáticos y kilometraje: el expediente de viaje (FASE A).
--
-- Los cinco anexos del Reglamento de Viajes no son cinco formularios: son
-- etapas de UN expediente. Separarlos en cinco tablas sueltas obligaría a
-- cosérlos después para contestar «¿cuánto se le aprobó a esta persona y
-- cuánto liquidó?», que es la pregunta que finanzas hace.
--
-- Esta migración trae la fase A: solicitud (ANX-01), presupuesto (ANX-02) y
-- las tres firmas convertidas en estados. Los estados de las fases B–D ya
-- están en el CHECK para no tener que tocarlo dos veces.

create table if not exists public.travel_requests (
  id uuid primary key default gen_random_uuid(),

  -- Quién viaja. El expediente es suyo: los datos personales del anexo
  -- (cédula, puesto, comité, correo, teléfono) NO se copian acá — se leen de
  -- la ficha al imprimir. Copiarlos sería tener dos versiones del teléfono de
  -- alguien y no saber cuál es la buena.
  member_id uuid not null references public.members(id) on delete cascade,

  status text not null default 'borrador',

  -- ANX-01 · de qué viaje se trata
  tipo text not null,                  -- trabajo | capacitacion
  alcance text not null,               -- nacional | internacional
  destino text not null,
  sale_at timestamptz not null,
  vuelve_at timestamptz not null,
  acompanantes text,

  -- ANX-01 · la justificación, que es lo que se aprueba
  objetivo text not null,
  agenda text,
  beneficio text,
  resultado_esperado text,

  -- ANX-01 · plata
  financiamiento text,                 -- de dónde sale
  centro_costo text,
  anticipo_monto numeric,
  anticipo_moneda text,

  -- ANX-02 · lo que llena finanzas al revisar
  monto_maximo_politica numeric,
  anticipo_recomendado numeric,
  disponibilidad_verificada boolean not null default false,
  notas_finanzas text,

  -- Las firmas, con actor y fecha. Dos columnas distintas y no una sola
  -- `reviewed_by`: el control de tres firmas del reglamento se pierde si
  -- revisión y aprobación caben en el mismo campo.
  revisado_por uuid references public.members(id) on delete set null,
  revisado_at timestamptz,
  aprobado_por uuid references public.members(id) on delete set null,
  aprobado_at timestamptz,
  motivo_rechazo text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint travel_requests_status_check check (status in (
    'borrador','enviada','en_revision','por_corregir','aprobada','rechazada','cancelada',
    'anticipo_entregado','en_viaje','liquidacion_pendiente','liquidada','cerrada')),
  constraint travel_requests_tipo_check check (tipo in ('trabajo','capacitacion')),
  constraint travel_requests_alcance_check check (alcance in ('nacional','internacional')),
  constraint travel_requests_moneda_check check (
    anticipo_moneda is null or anticipo_moneda in ('CRC','USD')),
  -- Un anticipo sin moneda es un número sin unidad, y con esa plata alguien
  -- compra pasajes.
  constraint travel_requests_anticipo_check check (
    (anticipo_monto is null) or (anticipo_monto >= 0 and anticipo_moneda is not null)),
  -- Volver antes de salir no es un viaje.
  constraint travel_requests_fechas_check check (vuelve_at >= sale_at)
);

create index if not exists travel_requests_member_idx on public.travel_requests (member_id);
create index if not exists travel_requests_status_idx on public.travel_requests (status, created_at desc);

-- ANX-02 · los rubros del presupuesto.
--
-- `subtotal` NO se guarda: es cantidad × tarifa y guardarlo abre la puerta a
-- que la fila diga 60.000 mientras sus factores dicen otra cosa. Se calcula
-- en `lib/travel/presupuesto`, que tiene los tests del redondeo.
create table if not exists public.travel_budget_items (
  id uuid primary key default gen_random_uuid(),
  travel_request_id uuid not null references public.travel_requests(id) on delete cascade,
  rubro text not null,
  descripcion text,
  cantidad numeric not null,
  tarifa numeric not null,
  moneda text not null,
  orden integer not null default 0,
  created_at timestamptz not null default now(),

  constraint travel_budget_items_rubro_check check (rubro in (
    'pasajes','transporte_local','hospedaje','alimentacion','inscripcion',
    'seguro','peajes','combustible','km','otros')),
  constraint travel_budget_items_moneda_check check (moneda in ('CRC','USD')),
  constraint travel_budget_items_cantidad_check check (cantidad > 0),
  constraint travel_budget_items_tarifa_check check (tarifa >= 0)
);

create index if not exists travel_budget_items_request_idx
  on public.travel_budget_items (travel_request_id, orden);

-- El historial: cada paso con quién y cuándo. Mismo patrón que
-- finance_request_status_history, que es el que ya lee el RequestBoard.
create table if not exists public.travel_request_status_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.travel_requests(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references public.members(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists travel_request_history_idx
  on public.travel_request_status_history (request_id, created_at);

-- RLS prendida y SIN políticas: todo pasa por el servidor con la llave de
-- servicio y su `requireRoles`. Dejarla apagada publicaría los viáticos de
-- todo el mundo en PostgREST con la llave pública del bundle (SEC-3).
alter table public.travel_requests enable row level security;
alter table public.travel_budget_items enable row level security;
alter table public.travel_request_status_history enable row level security;

create trigger set_updated_at_travel_requests
  before update on public.travel_requests
  for each row execute function public.set_updated_at();
