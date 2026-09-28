-- INF-2 · La RLS sobre `members` era recursiva: se arregla y se acota.
--
-- EL SÍNTOMA. Toda consulta a `members` como `authenticated` moría con
-- «infinite recursion detected in policy for relation members». Medido el
-- 2026-09-28 contra producción: fallaban members, areas, event_managers,
-- study_groups y payments — o sea casi todo, porque 120 de las 213 políticas
-- leían `members` dentro de su propia expresión y eso disparaba la política de
-- `members`, que se disparaba a sí misma.
--
-- NO ERA UNA FUGA: fallaba cerrada, con error y sin datos, y la app no la toca
-- porque lee y escribe con la llave de servicio. Pero la capa de defensa en
-- profundidad que todos damos por puesta era un error, no una política.
--
-- ══ BLOQUE 1: romper la recursión, sin cambiar ningún permiso ══
--
-- Las 120 políticas se reescriben contra los helpers de `private`, que son
-- SECURITY DEFINER y por eso NO vuelven a disparar RLS. La traducción es
-- mecánica y equivalente:
--
--   EXISTS (SELECT 1 FROM member_roles mr
--            WHERE mr.member_id IN (SELECT m.id FROM members m
--                                    WHERE m.auth_user_id = auth.uid())
--              AND mr.role = ANY (ARRAY[…]) AND mr.is_active)
--   →  private.has_any_role(ARRAY[…])
--
--   <col> IN (SELECT m.id FROM members m WHERE m.auth_user_id = auth.uid())
--   →  private.is_own_member(<col>)
--
-- El bloque 1 no decide nada: dice lo mismo que decían antes.
--
-- ══ BLOQUE 2: y además, acotar los datos personales ══
--
-- Arreglar la recursión ENCIENDE políticas que hoy fallan todas, y 23 de ellas
-- decían «pasa cualquiera que esté autenticado». Con 8.970 cuentas con login y
-- 24.034 fichas, eso dejaba RLS técnicamente funcionando y sin defender nada:
-- `members_select` habilitaba a cualquier cuenta a leer el padrón entero.
--
-- Decisión de Floriana (2026-09-28): acotar las de datos personales a «los
-- roles que ya ven ese módulo en la app, o tu propia ficha», y dejar abiertos
-- los CATÁLOGOS (áreas, sedes, tipos de evento, planes, formularios), donde
-- que cualquiera autenticado los lea es lo correcto y además hace falta para
-- responder un formulario o inscribirse a un evento.
--
-- Esto NO puede romper nada que funcione hoy: hoy esas políticas fallan TODAS
-- con error, así que nada depende de ellas.

begin;

-- ── Helpers ───────────────────────────────────────────────────────────────
-- Todos SECURITY DEFINER con `search_path` fijo: es lo que les permite leer
-- `members` sin volver a disparar su RLS, y lo que AGENTS.md exige para
-- cualquier función de `public`/`private`.

create or replace function private.mi_member_id()
returns uuid language sql stable security definer set search_path to 'public' as $$
  select m.id from members m where m.auth_user_id = (select auth.uid()) limit 1;
$$;
comment on function private.mi_member_id() is
  'INF-2: la ficha de quien llama. Sin releer members desde una política.';

create or replace function private.dirige_el_grupo(grupo uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from study_groups g
     where g.id = grupo
       and (g.leader_id = private.mi_member_id() or g.co_leader_id = private.mi_member_id())
  );
$$;

-- Un helper por módulo, con los MISMOS roles que la app le da alcance `all`
-- en `src/lib/auth/roles.ts`. Están fijados por un test que compara las dos
-- listas: si alguien agrega un rol en la app y no acá, el test falla.
create or replace function private.ve_padron()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select private.has_any_role(ARRAY['admin','direccion','solo_lectura','editor_perfiles',
    'comunicaciones','coordinador_dirigentes','coordinador_estudios','encargado_staff',
    'coordinador_servidores','finanzas']);
$$;

create or replace function private.ve_servidores()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select private.has_any_role(ARRAY['admin','direccion','solo_lectura','encargado_staff',
    'coordinador_servidores','aplicaciones_servicio','solicitudes_puestos','lider_comite']);
$$;

create or replace function private.ve_estudios()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select private.has_any_role(ARRAY['admin','direccion','solo_lectura','coordinador_estudios',
    'coordinador_dirigentes','editor_grupos_estudio']);
$$;

create or replace function private.ve_eventos()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select private.has_any_role(ARRAY['admin','direccion','solo_lectura','encargado_eventos']);
$$;

-- AGENTS.md: una función nace con EXECUTE para PUBLIC. Estas viven en
-- `private`, que PostgREST no publica, pero el revoke va igual: el esquema no
-- es el permiso.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure sig from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private'
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;
end $$;

commit;

-- ══════════════════════════════════════════════════════════════════════════
-- BLOQUE 1 · Las 120 políticas, sin la recursión y con el MISMO permiso.
-- Traducción mecánica; acá no se decide nada.
-- ══════════════════════════════════════════════════════════════════════════

begin;

drop policy if exists "areas_delete" on public.areas;
create policy "areas_delete" on public.areas
  as permissive for delete to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text])));

drop policy if exists "areas_insert" on public.areas;
create policy "areas_insert" on public.areas
  as permissive for insert to authenticated
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text])));

drop policy if exists "areas_select" on public.areas;
create policy "areas_select" on public.areas
  as permissive for select to authenticated
  using (((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text])) OR (( SELECT auth.role() AS role) = 'authenticated'::text)));

drop policy if exists "areas_update" on public.areas;
create policy "areas_update" on public.areas
  as permissive for update to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text])))
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text])));

drop policy if exists "audit_log_select" on public.audit_log;
create policy "audit_log_select" on public.audit_log
  as permissive for select to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text])));

drop policy if exists "employee_documents_delete" on public.employee_documents;
create policy "employee_documents_delete" on public.employee_documents
  as permissive for delete to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text])));

drop policy if exists "employee_documents_insert" on public.employee_documents;
create policy "employee_documents_insert" on public.employee_documents
  as permissive for insert to authenticated
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text])));

drop policy if exists "employee_documents_select" on public.employee_documents;
create policy "employee_documents_select" on public.employee_documents
  as permissive for select to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text])));

drop policy if exists "employee_documents_update" on public.employee_documents;
create policy "employee_documents_update" on public.employee_documents
  as permissive for update to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text])))
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text])));

drop policy if exists "employees_delete" on public.employees;
create policy "employees_delete" on public.employees
  as permissive for delete to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text])));

drop policy if exists "employees_insert" on public.employees;
create policy "employees_insert" on public.employees
  as permissive for insert to authenticated
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text])));

drop policy if exists "employees_select" on public.employees;
create policy "employees_select" on public.employees
  as permissive for select to authenticated
  using (((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text])) OR (private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'finanzas'::text]))));

drop policy if exists "employees_update" on public.employees;
create policy "employees_update" on public.employees
  as permissive for update to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text])))
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text])));

drop policy if exists "event_checkins_delete" on public.event_checkins;
create policy "event_checkins_delete" on public.event_checkins
  as permissive for delete to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "event_checkins_insert" on public.event_checkins;
create policy "event_checkins_insert" on public.event_checkins
  as permissive for insert to authenticated
  with check (((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])) OR (( SELECT auth.role() AS role) = 'authenticated'::text)));

drop policy if exists "event_checkins_select" on public.event_checkins;
create policy "event_checkins_select" on public.event_checkins
  as permissive for select to authenticated
  using (((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])) OR (( SELECT auth.role() AS role) = 'authenticated'::text)));

drop policy if exists "event_checkins_update" on public.event_checkins;
create policy "event_checkins_update" on public.event_checkins
  as permissive for update to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])))
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "event_managers_select" on public.event_managers;
create policy "event_managers_select" on public.event_managers
  as permissive for select to authenticated
  using ((private.is_admin() OR private.has_any_role(ARRAY['direccion'::text, 'encargado_staff'::text, 'comunicaciones'::text, 'encargado_eventos'::text]) OR private.is_own_member(member_id)));

drop policy if exists "event_registrations_delete" on public.event_registrations;
create policy "event_registrations_delete" on public.event_registrations
  as permissive for delete to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "event_registrations_insert" on public.event_registrations;
create policy "event_registrations_insert" on public.event_registrations
  as permissive for insert to authenticated
  with check (((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])) OR (( SELECT auth.role() AS role) = 'authenticated'::text)));

drop policy if exists "event_registrations_select" on public.event_registrations;
create policy "event_registrations_select" on public.event_registrations
  as permissive for select to authenticated
  using (((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])) OR (( SELECT auth.role() AS role) = 'authenticated'::text)));

drop policy if exists "event_registrations_update" on public.event_registrations;
create policy "event_registrations_update" on public.event_registrations
  as permissive for update to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])))
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "event_types_delete" on public.event_types;
create policy "event_types_delete" on public.event_types
  as permissive for delete to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "event_types_insert" on public.event_types;
create policy "event_types_insert" on public.event_types
  as permissive for insert to authenticated
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "event_types_select" on public.event_types;
create policy "event_types_select" on public.event_types
  as permissive for select to authenticated
  using (((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])) OR (( SELECT auth.role() AS role) = 'authenticated'::text)));

drop policy if exists "event_types_update" on public.event_types;
create policy "event_types_update" on public.event_types
  as permissive for update to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])))
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "event_volunteers_delete" on public.event_volunteers;
create policy "event_volunteers_delete" on public.event_volunteers
  as permissive for delete to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "event_volunteers_insert" on public.event_volunteers;
create policy "event_volunteers_insert" on public.event_volunteers
  as permissive for insert to authenticated
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "event_volunteers_select" on public.event_volunteers;
create policy "event_volunteers_select" on public.event_volunteers
  as permissive for select to authenticated
  using (((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])) OR (( SELECT auth.role() AS role) = 'authenticated'::text)));

drop policy if exists "event_volunteers_update" on public.event_volunteers;
create policy "event_volunteers_update" on public.event_volunteers
  as permissive for update to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])))
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "events_delete" on public.events;
create policy "events_delete" on public.events
  as permissive for delete to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "events_insert" on public.events;
create policy "events_insert" on public.events
  as permissive for insert to authenticated
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "events_select" on public.events;
create policy "events_select" on public.events
  as permissive for select to authenticated
  using (((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])) OR (( SELECT auth.role() AS role) = 'authenticated'::text)));

drop policy if exists "events_update" on public.events;
create policy "events_update" on public.events
  as permissive for update to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])))
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "finance_request_history_select" on public.finance_request_status_history;
create policy "finance_request_history_select" on public.finance_request_status_history
  as permissive for select to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'finanzas'::text])));

drop policy if exists "finance_requests_select" on public.finance_requests;
create policy "finance_requests_select" on public.finance_requests
  as permissive for select to authenticated
  using ((private.is_own_member(member_id) OR (private.has_any_role(ARRAY['admin'::text, 'finanzas'::text]))));

drop policy if exists "finance_requests_update" on public.finance_requests;
create policy "finance_requests_update" on public.finance_requests
  as permissive for update to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'finanzas'::text])));

drop policy if exists "form_access_grants_select" on public.form_access_grants;
create policy "form_access_grants_select" on public.form_access_grants
  as permissive for select to authenticated
  using ((private.is_admin() OR private.has_any_role(ARRAY['direccion'::text, 'comunicaciones'::text, 'encargado_staff'::text, 'forms'::text]) OR private.is_own_member(member_id)));

drop policy if exists "form_fields_delete" on public.form_fields;
create policy "form_fields_delete" on public.form_fields
  as permissive for delete to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'comunicaciones'::text])));

drop policy if exists "form_fields_insert" on public.form_fields;
create policy "form_fields_insert" on public.form_fields
  as permissive for insert to authenticated
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'comunicaciones'::text])));

drop policy if exists "form_fields_select" on public.form_fields;
create policy "form_fields_select" on public.form_fields
  as permissive for select to authenticated
  using (((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'comunicaciones'::text])) OR (( SELECT auth.role() AS role) = 'authenticated'::text)));

drop policy if exists "form_fields_update" on public.form_fields;
create policy "form_fields_update" on public.form_fields
  as permissive for update to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'comunicaciones'::text])))
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'comunicaciones'::text])));

drop policy if exists "form_response_values_select" on public.form_response_values;
create policy "form_response_values_select" on public.form_response_values
  as permissive for select to authenticated
  using ((EXISTS ( SELECT 1 FROM form_responses fr WHERE ((fr.id = form_response_values.response_id) AND ((fr.member_id = ( SELECT auth.uid() AS uid)) OR (private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'comunicaciones'::text])))))));

drop policy if exists "form_responses_select" on public.form_responses;
create policy "form_responses_select" on public.form_responses
  as permissive for select to authenticated
  using (((member_id = ( SELECT auth.uid() AS uid)) OR (private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'comunicaciones'::text]))));

drop policy if exists "forms_delete" on public.forms;
create policy "forms_delete" on public.forms
  as permissive for delete to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'comunicaciones'::text])));

drop policy if exists "forms_insert" on public.forms;
create policy "forms_insert" on public.forms
  as permissive for insert to authenticated
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'comunicaciones'::text])));

drop policy if exists "forms_update" on public.forms;
create policy "forms_update" on public.forms
  as permissive for update to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'comunicaciones'::text])))
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'comunicaciones'::text])));

drop policy if exists "internal_notifications_select" on public.internal_notifications;
create policy "internal_notifications_select" on public.internal_notifications
  as permissive for select to authenticated
  using (private.is_own_member(recipient_member_id));

drop policy if exists "internal_notifications_update" on public.internal_notifications;
create policy "internal_notifications_update" on public.internal_notifications
  as permissive for update to authenticated
  using (private.is_own_member(recipient_member_id));

drop policy if exists "mnp_insert" on public.member_notification_prefs;
create policy "mnp_insert" on public.member_notification_prefs
  as permissive for insert to authenticated
  with check ((private.is_admin() OR private.is_own_member(member_id)));

drop policy if exists "mnp_select" on public.member_notification_prefs;
create policy "mnp_select" on public.member_notification_prefs
  as permissive for select to authenticated
  using ((private.is_admin() OR private.is_own_member(member_id)));

drop policy if exists "mnp_update" on public.member_notification_prefs;
create policy "mnp_update" on public.member_notification_prefs
  as permissive for update to authenticated
  using ((private.is_admin() OR private.is_own_member(member_id)))
  with check ((private.is_admin() OR private.is_own_member(member_id)));

drop policy if exists "member_recommendations_insert" on public.member_recommendations;
create policy "member_recommendations_insert" on public.member_recommendations
  as permissive for insert to authenticated
  with check (((private.has_any_role(ARRAY['admin'::text, 'direccion'::text, 'coordinador_estudios'::text, 'coordinador_dirigentes'::text])) OR (private.dirige_el_grupo(member_recommendations.study_group_id))));

drop policy if exists "member_recommendations_select" on public.member_recommendations;
create policy "member_recommendations_select" on public.member_recommendations
  as permissive for select to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'direccion'::text, 'coordinador_estudios'::text, 'coordinador_dirigentes'::text, 'dirigente'::text])));

drop policy if exists "msd_insert" on public.member_spiritual_data;
create policy "msd_insert" on public.member_spiritual_data
  as permissive for insert to authenticated
  with check ((private.is_study_admin() OR private.is_own_member(member_id)));

drop policy if exists "msd_select" on public.member_spiritual_data;
create policy "msd_select" on public.member_spiritual_data
  as permissive for select to authenticated
  using ((private.is_study_admin() OR private.is_own_member(member_id)));

drop policy if exists "msd_update" on public.member_spiritual_data;
create policy "msd_update" on public.member_spiritual_data
  as permissive for update to authenticated
  using ((private.is_study_admin() OR private.is_own_member(member_id)))
  with check ((private.is_study_admin() OR private.is_own_member(member_id)));

drop policy if exists "members_delete" on public.members;
create policy "members_delete" on public.members
  as permissive for delete to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'editor_perfiles'::text])));

drop policy if exists "members_insert" on public.members;
create policy "members_insert" on public.members
  as permissive for insert to authenticated
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'editor_perfiles'::text])));

drop policy if exists "members_select" on public.members;
create policy "members_select" on public.members
  as permissive for select to authenticated
  using (((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'editor_perfiles'::text])) OR (( SELECT auth.role() AS role) = 'authenticated'::text)));

drop policy if exists "members_update" on public.members;
create policy "members_update" on public.members
  as permissive for update to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'editor_perfiles'::text])))
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'editor_perfiles'::text])));

drop policy if exists "message_broadcasts_delete" on public.message_broadcasts;
create policy "message_broadcasts_delete" on public.message_broadcasts
  as permissive for delete to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'comunicaciones'::text])));

drop policy if exists "message_broadcasts_insert" on public.message_broadcasts;
create policy "message_broadcasts_insert" on public.message_broadcasts
  as permissive for insert to authenticated
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'comunicaciones'::text])));

drop policy if exists "message_broadcasts_select" on public.message_broadcasts;
create policy "message_broadcasts_select" on public.message_broadcasts
  as permissive for select to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'comunicaciones'::text])));

drop policy if exists "message_broadcasts_update" on public.message_broadcasts;
create policy "message_broadcasts_update" on public.message_broadcasts
  as permissive for update to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'comunicaciones'::text])))
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'comunicaciones'::text])));

drop policy if exists "message_logs_select" on public.message_logs;
create policy "message_logs_select" on public.message_logs
  as permissive for select to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'comunicaciones'::text])));

drop policy if exists "message_templates_delete" on public.message_templates;
create policy "message_templates_delete" on public.message_templates
  as permissive for delete to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'comunicaciones'::text])));

drop policy if exists "message_templates_insert" on public.message_templates;
create policy "message_templates_insert" on public.message_templates
  as permissive for insert to authenticated
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'comunicaciones'::text])));

drop policy if exists "message_templates_select" on public.message_templates;
create policy "message_templates_select" on public.message_templates
  as permissive for select to authenticated
  using (((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'comunicaciones'::text])) OR (( SELECT auth.role() AS role) = 'authenticated'::text)));

drop policy if exists "message_templates_update" on public.message_templates;
create policy "message_templates_update" on public.message_templates
  as permissive for update to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'comunicaciones'::text])))
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'comunicaciones'::text])));

drop policy if exists "payment_categories_delete" on public.payment_categories;
create policy "payment_categories_delete" on public.payment_categories
  as permissive for delete to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'finanzas'::text])));

drop policy if exists "payment_categories_insert" on public.payment_categories;
create policy "payment_categories_insert" on public.payment_categories
  as permissive for insert to authenticated
  with check ((private.has_any_role(ARRAY['admin'::text, 'finanzas'::text])));

drop policy if exists "payment_categories_select" on public.payment_categories;
create policy "payment_categories_select" on public.payment_categories
  as permissive for select to authenticated
  using (((private.has_any_role(ARRAY['admin'::text, 'finanzas'::text])) OR (( SELECT auth.role() AS role) = 'authenticated'::text)));

drop policy if exists "payment_categories_update" on public.payment_categories;
create policy "payment_categories_update" on public.payment_categories
  as permissive for update to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'finanzas'::text])))
  with check ((private.has_any_role(ARRAY['admin'::text, 'finanzas'::text])));

drop policy if exists "payments_insert" on public.payments;
create policy "payments_insert" on public.payments
  as permissive for insert to authenticated
  with check ((private.has_any_role(ARRAY['admin'::text, 'finanzas'::text])));

drop policy if exists "payments_select" on public.payments;
create policy "payments_select" on public.payments
  as permissive for select to authenticated
  using (((private.has_any_role(ARRAY['admin'::text, 'finanzas'::text, 'encargado_staff'::text])) OR (member_id = ( SELECT auth.uid() AS uid))));

drop policy if exists "payments_update" on public.payments;
create policy "payments_update" on public.payments
  as permissive for update to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'finanzas'::text])))
  with check ((private.has_any_role(ARRAY['admin'::text, 'finanzas'::text])));

drop policy if exists "scholarships_delete" on public.scholarships;
create policy "scholarships_delete" on public.scholarships
  as permissive for delete to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'finanzas'::text])));

drop policy if exists "scholarships_insert" on public.scholarships;
create policy "scholarships_insert" on public.scholarships
  as permissive for insert to authenticated
  with check ((private.has_any_role(ARRAY['admin'::text, 'finanzas'::text])));

drop policy if exists "scholarships_select" on public.scholarships;
create policy "scholarships_select" on public.scholarships
  as permissive for select to authenticated
  using (((private.has_any_role(ARRAY['admin'::text, 'finanzas'::text])) OR (private.has_any_role(ARRAY['admin'::text, 'finanzas'::text, 'encargado_staff'::text]))));

drop policy if exists "scholarships_update" on public.scholarships;
create policy "scholarships_update" on public.scholarships
  as permissive for update to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'finanzas'::text])))
  with check ((private.has_any_role(ARRAY['admin'::text, 'finanzas'::text])));

drop policy if exists "sedes_delete" on public.sedes;
create policy "sedes_delete" on public.sedes
  as permissive for delete to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'direccion'::text])));

drop policy if exists "sedes_insert" on public.sedes;
create policy "sedes_insert" on public.sedes
  as permissive for insert to authenticated
  with check ((private.has_any_role(ARRAY['admin'::text, 'direccion'::text])));

drop policy if exists "sedes_select" on public.sedes;
create policy "sedes_select" on public.sedes
  as permissive for select to authenticated
  using (((private.has_any_role(ARRAY['admin'::text, 'direccion'::text])) OR (( SELECT auth.role() AS role) = 'authenticated'::text)));

drop policy if exists "sedes_update" on public.sedes;
create policy "sedes_update" on public.sedes
  as permissive for update to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'direccion'::text])))
  with check ((private.has_any_role(ARRAY['admin'::text, 'direccion'::text])));

drop policy if exists "service_positions_delete" on public.service_positions;
create policy "service_positions_delete" on public.service_positions
  as permissive for delete to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text])));

drop policy if exists "service_positions_insert" on public.service_positions;
create policy "service_positions_insert" on public.service_positions
  as permissive for insert to authenticated
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text])));

drop policy if exists "service_positions_select" on public.service_positions;
create policy "service_positions_select" on public.service_positions
  as permissive for select to authenticated
  using (((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text])) OR (( SELECT auth.role() AS role) = 'authenticated'::text)));

drop policy if exists "service_positions_update" on public.service_positions;
create policy "service_positions_update" on public.service_positions
  as permissive for update to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text])))
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text])));

drop policy if exists "study_attendance_delete" on public.study_attendance;
create policy "study_attendance_delete" on public.study_attendance
  as permissive for delete to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "study_attendance_insert" on public.study_attendance;
create policy "study_attendance_insert" on public.study_attendance
  as permissive for insert to authenticated
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "study_attendance_select" on public.study_attendance;
create policy "study_attendance_select" on public.study_attendance
  as permissive for select to authenticated
  using (((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])) OR (( SELECT auth.role() AS role) = 'authenticated'::text)));

drop policy if exists "study_attendance_update" on public.study_attendance;
create policy "study_attendance_update" on public.study_attendance
  as permissive for update to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])))
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "study_enrollments_delete" on public.study_enrollments;
create policy "study_enrollments_delete" on public.study_enrollments
  as permissive for delete to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "study_enrollments_insert" on public.study_enrollments;
create policy "study_enrollments_insert" on public.study_enrollments
  as permissive for insert to authenticated
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "study_enrollments_select" on public.study_enrollments;
create policy "study_enrollments_select" on public.study_enrollments
  as permissive for select to authenticated
  using (((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])) OR ((member_id = ( SELECT auth.uid() AS uid)) OR (private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])))));

drop policy if exists "study_enrollments_update" on public.study_enrollments;
create policy "study_enrollments_update" on public.study_enrollments
  as permissive for update to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])))
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "study_groups_delete" on public.study_groups;
create policy "study_groups_delete" on public.study_groups
  as permissive for delete to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "study_groups_insert" on public.study_groups;
create policy "study_groups_insert" on public.study_groups
  as permissive for insert to authenticated
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "study_groups_select" on public.study_groups;
create policy "study_groups_select" on public.study_groups
  as permissive for select to authenticated
  using (((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])) OR (( SELECT auth.role() AS role) = 'authenticated'::text)));

drop policy if exists "study_groups_update" on public.study_groups;
create policy "study_groups_update" on public.study_groups
  as permissive for update to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])))
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "study_plans_delete" on public.study_plans;
create policy "study_plans_delete" on public.study_plans
  as permissive for delete to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "study_plans_insert" on public.study_plans;
create policy "study_plans_insert" on public.study_plans
  as permissive for insert to authenticated
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "study_plans_select" on public.study_plans;
create policy "study_plans_select" on public.study_plans
  as permissive for select to authenticated
  using (((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])) OR (( SELECT auth.role() AS role) = 'authenticated'::text)));

drop policy if exists "study_plans_update" on public.study_plans;
create policy "study_plans_update" on public.study_plans
  as permissive for update to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])))
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "request_history_select" on public.study_request_status_history;
create policy "request_history_select" on public.study_request_status_history
  as permissive for select to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'coordinador_estudios'::text, 'coordinador_dirigentes'::text])));

drop policy if exists "study_requests_select" on public.study_requests;
create policy "study_requests_select" on public.study_requests
  as permissive for select to authenticated
  using ((private.is_own_member(member_id) OR (private.has_any_role(ARRAY['admin'::text, 'coordinador_estudios'::text, 'coordinador_dirigentes'::text]))));

drop policy if exists "study_requests_update" on public.study_requests;
create policy "study_requests_update" on public.study_requests
  as permissive for update to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'coordinador_estudios'::text, 'coordinador_dirigentes'::text])));

drop policy if exists "study_sessions_delete" on public.study_sessions;
create policy "study_sessions_delete" on public.study_sessions
  as permissive for delete to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "study_sessions_insert" on public.study_sessions;
create policy "study_sessions_insert" on public.study_sessions
  as permissive for insert to authenticated
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "study_sessions_select" on public.study_sessions;
create policy "study_sessions_select" on public.study_sessions
  as permissive for select to authenticated
  using (((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])) OR (( SELECT auth.role() AS role) = 'authenticated'::text)));

drop policy if exists "study_sessions_update" on public.study_sessions;
create policy "study_sessions_update" on public.study_sessions
  as permissive for update to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])))
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "sub_events_delete" on public.sub_events;
create policy "sub_events_delete" on public.sub_events
  as permissive for delete to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "sub_events_insert" on public.sub_events;
create policy "sub_events_insert" on public.sub_events
  as permissive for insert to authenticated
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "sub_events_select" on public.sub_events;
create policy "sub_events_select" on public.sub_events
  as permissive for select to authenticated
  using (((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])) OR (( SELECT auth.role() AS role) = 'authenticated'::text)));

drop policy if exists "sub_events_update" on public.sub_events;
create policy "sub_events_update" on public.sub_events
  as permissive for update to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])))
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'direccion'::text])));

drop policy if exists "volunteers_delete" on public.volunteers;
create policy "volunteers_delete" on public.volunteers
  as permissive for delete to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'lider_comite'::text])));

drop policy if exists "volunteers_insert" on public.volunteers;
create policy "volunteers_insert" on public.volunteers
  as permissive for insert to authenticated
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'lider_comite'::text])));

drop policy if exists "volunteers_select" on public.volunteers;
create policy "volunteers_select" on public.volunteers
  as permissive for select to authenticated
  using (((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'lider_comite'::text])) OR (( SELECT auth.role() AS role) = 'authenticated'::text)));

drop policy if exists "volunteers_update" on public.volunteers;
create policy "volunteers_update" on public.volunteers
  as permissive for update to authenticated
  using ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'lider_comite'::text])))
  with check ((private.has_any_role(ARRAY['admin'::text, 'encargado_staff'::text, 'lider_comite'::text])));

commit;

-- ══════════════════════════════════════════════════════════════════════════
-- BLOQUE 2 · Acotar los datos personales.
--
-- Acá SÍ se decide. Cada una de estas decía `… OR auth.role() =
-- 'authenticated'`, y ese OR volvía decorativa la primera mitad. Se reemplaza
-- por «el rol que ve ese módulo en la app, O es tu propio dato».
--
-- LOS CATÁLOGOS NO SE TOCAN y se dejan como estaban —areas, event_types,
-- sedes, study_plans, payment_categories, service_positions, events,
-- message_templates, forms, form_fields, sub_events—: que cualquiera
-- autenticado los lea es correcto, y además hace falta para responder un
-- formulario o inscribirse a un evento.
-- ══════════════════════════════════════════════════════════════════════════

begin;

-- El padrón. Antes: cualquier cuenta autenticada leía las 24.034 fichas.
-- `lider_comite` NO entra: a su gente la ve por /servidores, que es el mismo
-- criterio que SEC-1 fijó para el export del padrón.
drop policy if exists "members_select" on public.members;
create policy "members_select" on public.members
  as permissive for select to authenticated
  using (private.ve_padron() or id = private.mi_member_id());

-- Quién sirve en qué comité.
drop policy if exists "volunteers_select" on public.volunteers;
create policy "volunteers_select" on public.volunteers
  as permissive for select to authenticated
  using (private.ve_servidores() or member_id = private.mi_member_id());

-- Estudios: los coordinadores, el dirigente de ESE grupo, y lo propio.
drop policy if exists "study_groups_select" on public.study_groups;
create policy "study_groups_select" on public.study_groups
  as permissive for select to authenticated
  using (private.ve_estudios() or private.dirige_el_grupo(id));

drop policy if exists "study_sessions_select" on public.study_sessions;
create policy "study_sessions_select" on public.study_sessions
  as permissive for select to authenticated
  using (private.ve_estudios() or private.dirige_el_grupo(group_id));

-- La asistencia es de la persona: quien pasa lista la ve por su grupo.
drop policy if exists "study_attendance_select" on public.study_attendance;
create policy "study_attendance_select" on public.study_attendance
  as permissive for select to authenticated
  using (
    private.ve_estudios()
    or member_id = private.mi_member_id()
    or exists (select 1 from study_sessions s
                where s.id = study_attendance.session_id
                  and private.dirige_el_grupo(s.group_id))
  );

-- Eventos: quién se inscribió, quién llegó y quién sirvió.
drop policy if exists "event_registrations_select" on public.event_registrations;
create policy "event_registrations_select" on public.event_registrations
  as permissive for select to authenticated
  using (private.ve_eventos() or member_id = private.mi_member_id());

drop policy if exists "event_checkins_select" on public.event_checkins;
create policy "event_checkins_select" on public.event_checkins
  as permissive for select to authenticated
  using (private.ve_eventos() or member_id = private.mi_member_id());

drop policy if exists "event_volunteers_select" on public.event_volunteers;
create policy "event_volunteers_select" on public.event_volunteers
  as permissive for select to authenticated
  using (private.ve_eventos() or member_id = private.mi_member_id());

-- Las ESCRITURAS de autoservicio siguen existiendo, pero solo sobre uno mismo:
-- inscribirse a un evento y hacer check-in son cosas que la gente hace, y
-- antes `OR authenticated` dejaba inscribir o marcar A CUALQUIERA.
drop policy if exists "event_registrations_insert" on public.event_registrations;
create policy "event_registrations_insert" on public.event_registrations
  as permissive for insert to authenticated
  with check (private.ve_eventos() or member_id = private.mi_member_id());

drop policy if exists "event_checkins_insert" on public.event_checkins;
create policy "event_checkins_insert" on public.event_checkins
  as permissive for insert to authenticated
  with check (
    private.ve_eventos()
    or member_id = private.mi_member_id()
    -- El invitado sin ficha se marca con nombre a mano y sin member_id: es el
    -- flujo de la puerta, y quitarlo rompería el check-in de invitados.
    or member_id is null
  );

-- Responder un formulario: la respuesta es tuya o la registra quien tiene el
-- módulo. `form_response_values` cuelga de la respuesta, así que se acota por
-- ahí y no por member_id, que no tiene.
drop policy if exists "form_responses_insert" on public.form_responses;
create policy "form_responses_insert" on public.form_responses
  as permissive for insert to authenticated
  with check (
    private.has_any_role(ARRAY['admin','direccion','solo_lectura','forms',
      'comunicaciones','encargado_staff'])
    or member_id = private.mi_member_id()
    or member_id is null          -- respuesta anónima o de invitado
  );

drop policy if exists "form_response_values_insert" on public.form_response_values;
create policy "form_response_values_insert" on public.form_response_values
  as permissive for insert to authenticated
  with check (exists (
    select 1 from form_responses r where r.id = form_response_values.response_id
  ));

commit;
