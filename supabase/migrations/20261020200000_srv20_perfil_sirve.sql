-- SRV-20 · Perfil S.I.R.V.E. dentro del bloque espiritual del miembro.
--
-- Va en `member_spiritual_data` y no en una tabla nueva (decisión de
-- Floriana, 2026-10-20: «ya dentro de espirituales tenemos dones, entonces
-- deberían ser los mismos, no repetirlos»). Los dones del perfil S.I.R.V.E.
-- REEMPLAZAN al texto libre `spiritual_gifts`: el campo era un textarea que
-- solo 20 de 377 filas tenían lleno, y ahora los dones son dos listas del
-- catálogo (test de dones y oración de envío) más un texto para lo que no
-- está en el catálogo.
--
-- Los catálogos (dones, habilidades, pasiones, estilos) viven en código
-- (lib/servers/perfil-sirve.ts); se guarda el TEXTO de la opción, que es lo
-- que se lee en pantalla y en el Excel, y el servidor valida contra el
-- catálogo. Lo que no está en el catálogo va a los campos «otros».
--
-- `editado_en_sistema_at`: cuándo la persona (o alguien) lo tocó EN EL
-- SISTEMA. El import del formulario de CCB no pisa un perfil que tenga esto:
-- el dato fresco gana sobre el histórico.

alter table public.member_spiritual_data
  add column if not exists dones_test            text[] not null default '{}',
  add column if not exists dones_oracion         text[] not null default '{}',
  -- «No me dijeron ninguno en la oración»: distinto de no haber contestado.
  add column if not exists oracion_sin_dones     boolean not null default false,
  add column if not exists otros_dones           text,
  add column if not exists estilo_primario       text check (estilo_primario in ('Dominante','Influyente','Sólido','Concienzudo')),
  add column if not exists estilo_secundario     text check (estilo_secundario in ('Dominante','Influyente','Sólido','Concienzudo')),
  add column if not exists formacion             text,
  add column if not exists ocupacion             text,
  add column if not exists habilidades           text[] not null default '{}',
  add column if not exists otras_habilidades     text,
  add column if not exists pasiones              text[] not null default '{}',
  add column if not exists otras_pasiones        text,
  add column if not exists trayectoria           text,
  add column if not exists motivo_salida         text,
  add column if not exists que_espera            text,
  -- De dónde salió el perfil S.I.R.V.E.: 'sistema' (lo llenó acá) o 'ccb'
  -- (import del formulario 128). Null = todavía no tiene perfil S.I.R.V.E.
  add column if not exists sirve_fuente          text check (sirve_fuente in ('sistema','ccb')),
  add column if not exists sirve_ccb_response_id text,
  add column if not exists sirve_ccb_submitted_at timestamptz,
  add column if not exists editado_en_sistema_at timestamptz,
  add column if not exists updated_by            uuid references auth.users(id) on delete set null;

-- Los 20 textos libres de `spiritual_gifts` pasan a «otros dones» (el
-- import de CCB y la pantalla los van a ordenar; nada se pierde) y la
-- columna vieja se va: dos lugares para el mismo dato se desalinean.
update public.member_spiritual_data
   set otros_dones = coalesce(otros_dones, nullif(btrim(spiritual_gifts), ''))
 where nullif(btrim(spiritual_gifts), '') is not null;

alter table public.member_spiritual_data drop column if exists spiritual_gifts;

comment on table public.member_spiritual_data is
  'Bloque espiritual del miembro: bautismo y perfil S.I.R.V.E. (SRV-20: dones, estilo DISC, formación, habilidades, pasión, trayectoria). Lo edita la persona; el S.I.R.V.E. lo leen estudios, servidores, staff y dirección.';
