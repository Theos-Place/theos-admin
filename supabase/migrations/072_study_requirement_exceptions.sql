-- Excepciones de matrícula: un coordinador/admin exime a un miembro de requisitos
-- de un estudio para que pueda matricularse él mismo. Mismo patrón que study_invitations.
create table if not exists study_requirement_exceptions (
  id                  uuid primary key default uuid_generate_v4(),
  member_id           uuid not null references members(id) on delete cascade,
  plan_id             uuid not null references study_plans(id) on delete cascade,
  -- requisitos perdonados: 'donor','attendance','server','prerequisite'; o 'all'.
  waived_requirements text[] not null default '{}',
  reason              text,
  granted_by          uuid references members(id) on delete set null,
  status              text not null default 'active' check (status in ('active','revoked','used')),
  created_at          timestamptz default now(),
  revoked_at          timestamptz,
  unique(member_id, plan_id)
);

create index if not exists idx_sre_member_active on study_requirement_exceptions(member_id) where status = 'active';

-- RLS: igual que study_invitations — habilitado sin policies. Acceso vía service
-- role (createAdminClient); enforcement en los guards de la API (requireRoles):
-- coordinador_estudios/coordinador_dirigentes/dirección/admin (STUDY_ADMIN_ROLES).
alter table study_requirement_exceptions enable row level security;

comment on table study_requirement_exceptions is
  'Excepciones de requisitos de matrícula por (miembro, plan). waived_requirements: donor/attendance/server/prerequisite o all.';
