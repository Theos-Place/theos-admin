-- FRM-1 parte B · Encargados de un evento (2026-08-06)
--
-- Caso: la encargada de una actividad tiene que ver y gestionar TODO lo de ESE
-- evento —inscripciones, check-in, su formulario y las respuestas— y nada de los
-- demás. Eso no es un rol: es un permiso sobre un recurso.
--
-- Tabla ESPECÍFICA, no polimórfica (el plan proponía una `entity_managers`
-- genérica; decisión de TI el 2026-08-06 tras verlo con formularios): con
-- entity_type/entity_id no hay FK, así que borrar un evento deja filas colgando
-- apuntando a nada y cada lectura tiene que validar el tipo a mano. Dos tablas
-- chicas con FK real —esta y form_access_grants— se leen de un vistazo y se
-- limpian solas. La HERENCIA (el formulario de un evento lo ve su encargado) se
-- resuelve en la función de permisos, no en la forma de la tabla.

CREATE TABLE IF NOT EXISTS public.event_managers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES public.events(id)  ON DELETE CASCADE,
  member_id  UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  granted_by UUID          REFERENCES public.members(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_managers_unique UNIQUE (event_id, member_id)
);

COMMENT ON TABLE public.event_managers IS
  'Encargados de UN evento: ven y gestionan ese evento (inscripciones, check-in, su formulario y respuestas) sin tener el rol global de eventos. No alcanza a ningún otro evento.';

CREATE INDEX IF NOT EXISTS idx_event_managers_member ON public.event_managers (member_id);
CREATE INDEX IF NOT EXISTS idx_event_managers_event  ON public.event_managers (event_id);

ALTER TABLE public.event_managers ENABLE ROW LEVEL SECURITY;

-- Las queries de la app corren con service role (saltan RLS); la autorización
-- real vive en los guards de las rutas. Esto es la red para la llave anónima.
DROP POLICY IF EXISTS event_managers_select ON public.event_managers;
CREATE POLICY event_managers_select ON public.event_managers
  FOR SELECT TO authenticated
  USING (
    private.is_admin()
    OR private.has_any_role(ARRAY['direccion', 'encargado_staff', 'comunicaciones', 'encargado_eventos'])
    OR member_id IN (SELECT m.id FROM public.members m WHERE m.auth_user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS event_managers_write ON public.event_managers;
CREATE POLICY event_managers_write ON public.event_managers
  FOR ALL TO authenticated
  USING (private.is_admin() OR private.has_any_role(ARRAY['direccion', 'encargado_staff', 'comunicaciones']))
  WITH CHECK (private.is_admin() OR private.has_any_role(ARRAY['direccion', 'encargado_staff', 'comunicaciones']));
