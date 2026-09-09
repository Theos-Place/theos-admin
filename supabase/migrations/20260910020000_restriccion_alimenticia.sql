-- Restricción alimenticia en el perfil, junto a alergias y medicamentos.
--
-- text[] y no jsonb: es una lista plana de claves, que es exactamente cómo el
-- esquema ya modela study_groups.schedule_days, study_leaders.qualified_study_codes
-- y prematrimonial_requests.zones. jsonb queda para estructuras con forma.
--
-- Se guardan CLAVES ('celiaquia', 'intolerancia_lactosa', 'vegana', 'otros') y
-- no las etiquetas en español: renombrar una opción no debe obligar a reescribir
-- filas ni dejar dos escrituras del mismo valor conviviendo. Las etiquetas viven
-- en src/lib/members/restriccion-alimenticia.ts.
--
-- Los ~23k miembros existentes quedan con el arreglo vacío. Sin migración de
-- datos a propósito: no hay de dónde inferirlo, y se va llenando por el
-- autoservicio del formulario y por FIN-2.

alter table members
  add column if not exists dietary_restrictions text[] not null default '{}',
  add column if not exists dietary_restrictions_other text;

-- El CHECK cierra la lista en la BASE, no solo en la app: sin esto, cualquier
-- import o script podría meter una clave que la pantalla después no sabe pintar.
alter table members
  drop constraint if exists members_dietary_restrictions_check;
alter table members
  add constraint members_dietary_restrictions_check
  check (dietary_restrictions <@ array['celiaquia','intolerancia_lactosa','vegana','otros']::text[]);

-- El texto libre solo tiene sentido con 'otros' marcado, y 'otros' sin texto no
-- le dice nada a quien cocina. Los dos lados del invariante, en la base.
alter table members
  drop constraint if exists members_dietary_other_check;
alter table members
  add constraint members_dietary_other_check
  check (
    ('otros' = any(dietary_restrictions)) = (nullif(btrim(coalesce(dietary_restrictions_other,'')),'') is not null)
  );

comment on column members.dietary_restrictions is
  'Claves de restricción alimenticia. Etiquetas en src/lib/members/restriccion-alimenticia.ts.';
comment on column members.dietary_restrictions_other is
  'Detalle cuando ''otros'' está marcado. Obligatorio en ese caso, nulo en el resto (CHECK).';

-- Para que cocina/logística pueda filtrar a los inscritos que traen restricción
-- sin recorrer la tabla entera.
create index if not exists members_dietary_restrictions_idx
  on members using gin (dietary_restrictions);
