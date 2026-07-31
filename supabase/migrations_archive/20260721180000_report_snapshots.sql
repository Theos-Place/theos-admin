-- Caché de reportes pesados. Un cron nocturno guarda acá el dataset crudo de
-- cada RPC de reporte (get_dm_flags, get_group_attendance, etc.) y las páginas
-- leen de esta tabla en vez de re-agregar sobre 160k+ check-ins en cada carga.
-- Solo el service role (admin client) accede; RLS activo sin políticas = deny a
-- clientes normales.
create table if not exists public.report_snapshots (
  report_key text primary key,
  data jsonb not null,
  row_count int,
  updated_at timestamptz not null default now()
);

alter table public.report_snapshots enable row level security;

comment on table public.report_snapshots is
  'Caché de datasets de reportes, refrescada por el cron /api/cron/report-snapshots. report_key = dataset (dm_flags, dm_milestones, group_attendance, charla_attendance, member_growth).';
