-- Amplía el CHECK de member_roles.role para incluir roles que YA existían en el
-- código (ROLES en src/lib/auth/roles.ts) pero no en la constraint —por eso no se
-- podían asignar desde la UI (el INSERT fallaba)—, más el rol nuevo
-- 'editor_grupos_estudio'.
--   Agregados: folletos, becas, revision_pagos, editor_grupos_estudio.
alter table public.member_roles drop constraint if exists member_roles_role_check;
alter table public.member_roles add constraint member_roles_role_check
  check (role = any (array[
    'admin', 'direccion', 'finanzas', 'encargado_staff', 'coordinador_servidores',
    'coordinador_estudios', 'coordinador_dirigentes', 'encargado_eventos',
    'lider_comite', 'comunicaciones', 'dirigente', 'editor_perfiles',
    'miembro', 'solo_lectura', 'reportes',
    'folletos', 'becas', 'revision_pagos', 'editor_grupos_estudio'
  ]::text[]));
