-- FIN-11 · Informe de viaje (ANX-04), fase D.
--
-- NO SALIÓ DEL MÓDULO DE FORMULARIOS, que era lo que el plan sugería, y la
-- razón está medida: `lib/forms/fill-access` deja cerrado por defecto todo
-- formulario suelto sin audiencia definida (decisión del 2026-08-06, puesta
-- para que nadie se preinscribiera a CDEB sin ser recomendado). Un informe de
-- viaje es justamente un formulario suelto, así que cada persona que volviera
-- se habría topado con «este formulario no está abierto para vos» y habría
-- que convocarla a mano por cada viaje.

alter table public.travel_requests
  add column if not exists informe_actividades text,
  add column if not exists informe_resultados text,
  add column if not exists informe_lecciones text,
  add column if not exists informe_recomendaciones text,
  add column if not exists informe_enviado_at timestamptz,
  add column if not exists informe_enviado_por uuid references public.members(id) on delete set null;

-- La evidencia del informe: fotos, presentaciones, certificados. Tabla aparte
-- y no un arreglo de rutas en la fila: cada archivo necesita su nombre
-- original para que quien lo abra sepa qué es, y un jsonb con objetos adentro
-- es una tabla escrita a mano y sin constraints.
create table if not exists public.travel_report_files (
  id uuid primary key default gen_random_uuid(),
  travel_request_id uuid not null references public.travel_requests(id) on delete cascade,
  path text not null,
  nombre text not null,
  created_at timestamptz not null default now()
);

create index if not exists travel_report_files_request_idx
  on public.travel_report_files (travel_request_id);

alter table public.travel_report_files enable row level security;
