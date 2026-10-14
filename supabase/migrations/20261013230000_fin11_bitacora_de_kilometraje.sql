-- FIN-11 · Bitácora de kilometraje (ANX-05), fase C.
--
-- Una fila por desplazamiento, con odómetro. `km_recorridos` NO se guarda:
-- es `km_final - km_inicial` y guardarlo abre la puerta a que la fila diga
-- 220 mientras sus lecturas dicen otra cosa — la misma razón por la que el
-- subtotal del presupuesto tampoco se guarda.

create table if not exists public.travel_mileage_legs (
  id uuid primary key default gen_random_uuid(),
  travel_request_id uuid not null references public.travel_requests(id) on delete cascade,
  fecha date not null,
  origen text not null,
  destino text not null,
  hora_salida text,
  hora_regreso text,
  km_inicial numeric not null,
  km_final numeric not null,
  orden integer not null default 0,
  created_at timestamptz not null default now(),

  constraint travel_mileage_legs_odometro_check check (km_inicial >= 0 and km_final >= km_inicial),
  -- Un tramo de cero kilómetros no es un tramo.
  constraint travel_mileage_legs_recorrido_check check (km_final > km_inicial)
);

create index if not exists travel_mileage_legs_request_idx
  on public.travel_mileage_legs (travel_request_id, orden);

alter table public.travel_mileage_legs enable row level security;

alter table public.travel_requests
  -- Requisito de la minuta del 2026-09-29: el de kilometraje «incluirá como
  -- requisito adjuntar la aprobación del jefe/supervisor del viaje». Es OTRA
  -- firma que la declaración jurada: esa la pone quien viajó, esta quien lo
  -- autorizó.
  add column if not exists aprobacion_jefe_path text,
  -- LA TARIFA CONGELADA. Se copia al enviar la bitácora y desde ahí manda
  -- ella: si la tarifa del reglamento sube el año que viene, un expediente
  -- ya liquidado no puede cambiar de monto solo porque se recalcule. Sin
  -- esto, la plata que alguien ya recibió dejaría de coincidir con lo que el
  -- sistema dice que se le reconoció.
  add column if not exists tarifa_km_aplicada numeric,
  add column if not exists tarifa_km_moneda text;

alter table public.travel_requests
  drop constraint if exists travel_requests_tarifa_km_moneda_check;
alter table public.travel_requests
  add constraint travel_requests_tarifa_km_moneda_check check (
    tarifa_km_moneda is null or tarifa_km_moneda in ('CRC','USD'));
