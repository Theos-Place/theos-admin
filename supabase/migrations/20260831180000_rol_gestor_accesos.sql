-- Rol 'gestor_accesos' en el CHECK de member_roles (eran 21, quedan 22).
--
-- POR QUÉ UN ROL Y NO UNA ACCIÓN MÁS DE LAS COORDINACIONES: cambiar el correo
-- de acceso decide con qué dirección se entra a una cuenta. Apuntarla a un
-- correo propio es quedarse con la cuenta ajena. Crear la cuenta y mandar el
-- enlace de contraseña siguen siendo de STUDY_ADMIN_ROLES; esto no.
--
-- El rol NO otorga permisos de módulo: no abre ninguna pantalla. Es un añadido
-- para quien ya administra perfiles.
--
-- Mismo patrón que 20260822140000 (rol 'evaluaciones'), que es la definición
-- vigente del CHECK; la del baseline quedó atrás.
ALTER TABLE public.member_roles DROP CONSTRAINT IF EXISTS member_roles_role_check;
ALTER TABLE public.member_roles ADD CONSTRAINT member_roles_role_check CHECK (
  role = ANY (ARRAY[
    'admin', 'direccion', 'finanzas', 'encargado_staff', 'coordinador_servidores',
    'coordinador_estudios', 'coordinador_dirigentes', 'encargado_eventos',
    'lider_comite', 'comunicaciones', 'dirigente', 'editor_perfiles', 'miembro',
    'solo_lectura', 'reportes', 'folletos', 'becas', 'revision_pagos',
    'editor_grupos_estudio', 'forms', 'evaluaciones', 'gestor_accesos'
  ])
);
