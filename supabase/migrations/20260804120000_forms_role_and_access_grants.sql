-- 2026-08-04
-- 1) Rol nuevo 'forms': gestiona TODOS los formularios y sus respuestas.
-- 2) Accesos puntuales por formulario: dar a una persona concreta la lectura y
--    exportación de las respuestas de UN formulario y de ningún otro (caso
--    típico: la encargada de una actividad).

-- ── 1. Rol 'forms' en el CHECK de member_roles (eran 19 roles, quedan 20) ────
ALTER TABLE public.member_roles DROP CONSTRAINT IF EXISTS member_roles_role_check;
ALTER TABLE public.member_roles ADD CONSTRAINT member_roles_role_check CHECK (
  role = ANY (ARRAY[
    'admin', 'direccion', 'finanzas', 'encargado_staff', 'coordinador_servidores',
    'coordinador_estudios', 'coordinador_dirigentes', 'encargado_eventos',
    'lider_comite', 'comunicaciones', 'dirigente', 'editor_perfiles', 'miembro',
    'solo_lectura', 'reportes', 'folletos', 'becas', 'revision_pagos',
    'editor_grupos_estudio', 'forms'
  ])
);

-- ── 2. Accesos por formulario ───────────────────────────────────────────────
-- Tabla ESPECÍFICA de formularios, no polimórfica: la autorización se lee de un
-- vistazo y el FK a forms garantiza integridad (un grant no puede quedar
-- colgando de un formulario borrado). Si mañana hace falta lo mismo para
-- eventos y grupos, se agregan sus tablas hermanas — ver la nota en
-- src/lib/auth/forms-scope.ts.
CREATE TABLE IF NOT EXISTS public.form_access_grants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id    UUID NOT NULL REFERENCES public.forms(id)   ON DELETE CASCADE,
  member_id  UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  granted_by UUID          REFERENCES public.members(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT form_access_grants_unique UNIQUE (form_id, member_id)
);

COMMENT ON TABLE public.form_access_grants IS
  'Acceso puntual a UN formulario: la persona ve y exporta las respuestas de ese formulario y de ningún otro. No da permiso para editar la estructura del formulario.';

CREATE INDEX IF NOT EXISTS idx_form_access_grants_member ON public.form_access_grants (member_id);
CREATE INDEX IF NOT EXISTS idx_form_access_grants_form   ON public.form_access_grants (form_id);

ALTER TABLE public.form_access_grants ENABLE ROW LEVEL SECURITY;

-- Las queries de la app corren con service role (saltan RLS); la autorización
-- real vive en los guards de las rutas API. Estas policies son la red de
-- seguridad para cualquier acceso con la llave anónima.
DROP POLICY IF EXISTS form_access_grants_select ON public.form_access_grants;
CREATE POLICY form_access_grants_select ON public.form_access_grants
  FOR SELECT TO authenticated
  USING (
    private.is_admin()
    OR private.has_any_role(ARRAY['direccion', 'comunicaciones', 'encargado_staff', 'forms'])
    -- Cada quien puede ver SUS propios accesos.
    OR member_id IN (SELECT m.id FROM public.members m WHERE m.auth_user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS form_access_grants_write ON public.form_access_grants;
CREATE POLICY form_access_grants_write ON public.form_access_grants
  FOR ALL TO authenticated
  USING (private.is_admin() OR private.has_any_role(ARRAY['direccion', 'comunicaciones', 'encargado_staff', 'forms']))
  WITH CHECK (private.is_admin() OR private.has_any_role(ARRAY['direccion', 'comunicaciones', 'encargado_staff', 'forms']));

-- El rol 'forms' también entra en las policies de los formularios y sus
-- respuestas (hasta ahora: admin, encargado_staff, comunicaciones).
DROP POLICY IF EXISTS forms_select ON public.forms;
CREATE POLICY forms_select ON public.forms
  FOR SELECT TO authenticated
  USING (
    private.is_admin()
    OR private.has_any_role(ARRAY['encargado_staff', 'comunicaciones', 'direccion', 'forms'])
    OR (is_active = true AND (is_public = true OR (SELECT auth.role()) = 'authenticated'))
  );
