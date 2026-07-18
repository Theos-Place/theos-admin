-- Auditoría db (docs/db-audit-2026-07-18.md) — pendiente RLS post-squash.
-- A) 10 tablas con RLS on pero SIN políticas (deny-all salvo service role):
--    se les da política por rol del módulo + admin siempre.
-- B) 7 tablas con SELECT abierto a cualquier 'authenticated': se restringe a
--    staff del módulo, permitiendo self-access donde hay member_id.
-- El acceso real del app es por service role vía /api (salta RLS); esto es
-- defensa en profundidad para eventuales queries client-side.

-- ===================== A) TABLAS SIN POLÍTICAS =====================
-- Estudios (admin o study-admin)
create policy capacitacion_bloques_all on capacitacion_bloques for all to authenticated
  using (private.is_admin() or private.is_study_admin()) with check (private.is_admin() or private.is_study_admin());
create policy folleto_requests_all on folleto_requests for all to authenticated
  using (private.is_admin() or private.is_study_admin()) with check (private.is_admin() or private.is_study_admin());
create policy study_invitations_all on study_invitations for all to authenticated
  using (private.is_admin() or private.is_study_admin()) with check (private.is_admin() or private.is_study_admin());
create policy study_requirement_exceptions_all on study_requirement_exceptions for all to authenticated
  using (private.is_admin() or private.is_study_admin()) with check (private.is_admin() or private.is_study_admin());

-- Eventos (admin o encargado_eventos/direccion)
create policy event_exceptions_all on event_exceptions for all to authenticated
  using (private.is_admin() or private.has_any_role(array['encargado_eventos','direccion']))
  with check (private.is_admin() or private.has_any_role(array['encargado_eventos','direccion']));
create policy event_organizing_committees_all on event_organizing_committees for all to authenticated
  using (private.is_admin() or private.has_any_role(array['encargado_eventos','direccion']))
  with check (private.is_admin() or private.has_any_role(array['encargado_eventos','direccion']));

-- Servidores (admin o coordinador_servidores/encargado_staff/direccion)
create policy position_requests_all on position_requests for all to authenticated
  using (private.is_admin() or private.has_any_role(array['coordinador_servidores','encargado_staff','direccion']))
  with check (private.is_admin() or private.has_any_role(array['coordinador_servidores','encargado_staff','direccion']));

-- Finanzas (admin o finanzas/direccion)
create policy scholarship_redemptions_all on scholarship_redemptions for all to authenticated
  using (private.is_admin() or private.has_any_role(array['finanzas','direccion']))
  with check (private.is_admin() or private.has_any_role(array['finanzas','direccion']));

-- Solo admin
create policy duplicate_dismissals_all on duplicate_dismissals for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy member_role_position_grants_all on member_role_position_grants for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- ===================== B) SELECT PERMISIVO → RESTRINGIDO =====================
drop policy if exists channel_configs_select on channel_configs;
create policy channel_configs_select on channel_configs for select to authenticated
  using (private.is_admin() or private.has_any_role(array['comunicaciones']));

drop policy if exists committee_goals_select on committee_goals;
create policy committee_goals_select on committee_goals for select to authenticated
  using (private.is_admin() or private.has_any_role(array['coordinador_servidores','lider_comite','direccion']));

drop policy if exists member_lists_select on member_lists;
create policy member_lists_select on member_lists for select to authenticated
  using (private.is_admin() or private.has_any_role(array['comunicaciones','direccion']));

-- family: staff de perfiles + admin + el propio miembro ve su familia
drop policy if exists family_members_select on family_members;
create policy family_members_select on family_members for select to authenticated
  using (private.is_admin() or private.is_own_member(member_id) or private.has_any_role(array['editor_perfiles','encargado_staff','direccion']));

drop policy if exists family_units_select on family_units;
create policy family_units_select on family_units for select to authenticated
  using (private.is_admin() or private.has_any_role(array['editor_perfiles','encargado_staff','direccion'])
    or exists (select 1 from family_members fm where fm.family_unit_id = family_units.id and private.is_own_member(fm.member_id)));

-- study_leaders: study-admin + admin + el propio dirigente ve su registro
drop policy if exists study_leaders_select on study_leaders;
create policy study_leaders_select on study_leaders for select to authenticated
  using (private.is_admin() or private.is_study_admin() or private.is_own_member(member_id));

-- vacancies: lectura PÚBLICA para cualquier usuario autenticado, sin importar rol.
-- Decisión de negocio: las vacantes son públicas (cualquiera puede verlas/aplicar).
drop policy if exists vacancies_select on vacancies;
create policy vacancies_select on vacancies for select to authenticated using (true);
