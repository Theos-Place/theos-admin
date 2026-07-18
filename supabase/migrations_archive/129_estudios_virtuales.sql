-- Estudios virtuales: los grupos pueden marcarse como virtuales, y solo los
-- miembros autorizados pueden ver/matricularse en ellos. Grupos existentes
-- quedan sin la marca (presenciales) por defecto.

alter table study_groups
  add column if not exists is_virtual boolean not null default false;

-- Autorización por miembro: vive en member_admin_data (el miembro NUNCA
-- accede, mismo patrón que approved_to_lead_studies — migración 091).
alter table member_admin_data
  add column if not exists authorized_virtual_studies boolean not null default false,
  add column if not exists authorized_virtual_studies_by uuid references members(id) on delete set null,
  add column if not exists authorized_virtual_studies_at timestamptz;
