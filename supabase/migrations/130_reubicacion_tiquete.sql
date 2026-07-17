-- Reubicación de estudios como tiquete: campos nuevos capturados en la
-- solicitud (para que el encargado resuelva sin tener que llamar al miembro),
-- y trazabilidad de la resolución real (grupo elegido, matrícula y folleto
-- generados). No agrega un request_type nuevo — sigue siendo 'relocation'.
alter table study_requests
  add column if not exists needed_study_code text
    check (needed_study_code is null or needed_study_code in ('N2','N3','N4','DIS2','DIS3')),
  add column if not exists last_class_attended text
    check (last_class_attended is null or last_class_attended in (
      '1','2','3','4','5','6','7','8','9','10','11','12','no_recuerda'
    )),
  add column if not exists last_leader_name text,
  add column if not exists wants_folleto boolean not null default false,
  add column if not exists resolved_group_id uuid references study_groups(id) on delete set null,
  add column if not exists resulting_enrollment_id uuid references study_enrollments(id) on delete set null,
  add column if not exists resulting_folleto_request_id uuid references folleto_requests(id) on delete set null;

-- folleto_requests: nuevo tipo 'reubicacion' — folleto individual generado al
-- resolver un tiquete de reubicación (no por cierre de grupo ni preapertura).
-- Misma cola/flujo de impresión-entrega que el resto.
alter table folleto_requests drop constraint if exists folleto_requests_tipo_check;
alter table folleto_requests add constraint folleto_requests_tipo_check
  check (tipo = any (array['cierre','preapertura_preliminar','preapertura_confirmacion','preapertura_final','reubicacion']::text[]));
