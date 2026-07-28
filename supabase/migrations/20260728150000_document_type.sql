-- INT-1: documento de identidad por tipo (internacionalización Madrid/Colombia).
-- members.cedula pasa a guardar el NÚMERO del documento del tipo indicado en
-- document_type; cedula_normalized (columna GENERADA que quita guiones y
-- espacios) sigue siendo la base de normalización/dedup para cualquier tipo.
-- Los ~23k registros CR existentes quedan como document_type='cedula' (default).

alter table "public"."members" add column "document_type" text not null default 'cedula'
  check ("document_type" = any (array['cedula'::text, 'dni_nie'::text, 'pasaporte'::text, 'otro'::text]));

comment on column "public"."members"."cedula" is
  'Número del documento de identidad (del tipo en document_type). Para CR es la cédula; cedula_normalized lo normaliza para dedup.';

-- Dedup por PAREJA (tipo, número normalizado): un mismo número en tipos
-- distintos no colisiona (p. ej. un DNI español no choca con una cédula CR).
drop index if exists "members_cedula_norm_uniq";
create unique index "members_document_norm_uniq"
  on "public"."members" ("document_type", "cedula_normalized")
  where ("cedula_normalized" is not null and not "cedula_dup_legacy");
