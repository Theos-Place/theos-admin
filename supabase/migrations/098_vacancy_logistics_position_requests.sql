-- Rediseño de vacantes/puestos.
-- 1) Campos logísticos PROPIOS de la vacante (la descripción/funciones/perfil
--    viven en el puesto, no acá).
alter table vacancies add column if not exists expires_at date;
alter table vacancies add column if not exists location text;
alter table vacancies add column if not exists notes text;
alter table vacancies add column if not exists is_featured boolean not null default false;

-- 2) Solicitudes de PUESTO NUEVO: cuando el puesto no existe en el catálogo, el
--    coordinador lo solicita y Staff/admin aprueba antes de crearlo.
create table if not exists position_requests (
  id                  uuid primary key default gen_random_uuid(),
  committee_id        uuid not null references areas(id) on delete cascade,
  title               text not null,
  description         text,
  functions           text,
  profile             text,
  study_requirement   text,
  status              text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by        uuid references members(id) on delete set null,
  reviewed_by         uuid references members(id) on delete set null,
  reviewed_at         timestamptz,
  created_position_id uuid references service_positions(id) on delete set null,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
create index if not exists idx_position_requests_status    on position_requests(status);
create index if not exists idx_position_requests_committee on position_requests(committee_id);

-- La app accede con service role (salta RLS); habilitamos RLS para bloquear
-- accesos con anon/auth key (sin política = sin acceso por esa vía).
alter table position_requests enable row level security;
