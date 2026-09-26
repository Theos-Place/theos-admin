-- SRV-15 · Los puestos no se publican solos.
--
-- LO QUE CORRIGE. SRV-12 dejó que una solicitud hecha por un rol
-- administrativo entrara ya APROBADA (`autoApprove`), o sea publicada sin que
-- nadie apretara nada. La regla correcta, dictada el 2026-09-26: nada queda
-- publicado hasta que una persona le dé «Publicar puestos».
--
-- EL CICLO QUEDA EN TRES ESTADOS, y son los tres que alguien puede señalar en
-- la pantalla:
--   lista_para_publicar → entra así SIEMPRE, la pida quien la pida.
--   publicada           → alguien apretó Publicar; está en la página pública.
--   despublicada        → la bajó la publicación siguiente, o una persona.
--                         Conserva sus aplicaciones.
--
-- SE UNIFICAN NOMBRES, que era parte del pedido:
--   'creado'        → 'lista_para_publicar'
--   'enviado_lider' → 'lista_para_publicar'  (paso intermedio que nunca se usó:
--                      CERO filas en producción y en staging)
--   'aprobado'      → 'publicada'
--   'cerrada'       → 'despublicada'         (era la misma cosa con otro nombre:
--                      «dejó de aceptar aplicaciones» = «ya no está publicada»)
--
-- 'denegado' SE QUEDA aunque el pedido no lo nombre: negar una solicitud es un
-- desenlace real y distinto de bajarla —nunca estuvo publicada—, y borrarlo
-- dejaría sin estado a quien la rechace. Hoy tiene cero filas.
--
-- EL RIESGO ES CHICO Y MEDIDO: producción tiene 1 vacante ('creado') y staging
-- 4 ('aprobado'). Renombrar ahora cuesta dos UPDATE; dentro de seis meses, una
-- migración de verdad.

ALTER TABLE public.vacancies DROP CONSTRAINT IF EXISTS vacancies_status_check;

UPDATE public.vacancies SET status = 'lista_para_publicar'
 WHERE status IN ('creado', 'enviado_lider');
UPDATE public.vacancies SET status = 'publicada'    WHERE status = 'aprobado';
UPDATE public.vacancies SET status = 'despublicada' WHERE status = 'cerrada';

ALTER TABLE public.vacancies ADD CONSTRAINT vacancies_status_check
  CHECK (status = ANY (ARRAY['lista_para_publicar', 'publicada', 'despublicada', 'denegado']));

-- El default de la columna era 'creado': sin cambiarlo, cualquier inserción
-- que no diga el estado revienta contra el CHECK nuevo.
ALTER TABLE public.vacancies ALTER COLUMN status SET DEFAULT 'lista_para_publicar';
