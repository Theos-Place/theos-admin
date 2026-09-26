-- SRV-14 · Rol nuevo: `aplicaciones_servicio`.
--
-- QUÉ ABRE. La bandeja de aplicaciones a puestos de servicio
-- (/servidores/aplicaciones), que hasta hoy era SOLO de
-- `coordinador_servidores` y `admin` (decisión 2026-07-30). El trabajo de
-- revisarlas, mandárselas al encargado y seguirlas lo hacen dos puestos del
-- comité de servidores, y no había forma de darles esa bandeja sin volverlos
-- coordinadores de todo.
--
-- LO OTORGAN DOS PUESTOS QUE YA EXISTEN, verificados en el catálogo antes de
-- escribir la regla (es la misma trampa de SRV-11: los nombres reales no
-- llevan los «de»):
--   · «Colaborador Aplicaciones» — 1 persona
--   · «Colaborador Seguimiento»  — 1 persona
--
-- `direccion` entra también, como vista, según el mapa de accesos de la Fase 24.

alter table member_roles drop constraint if exists member_roles_role_check;

alter table member_roles add constraint member_roles_role_check check (role = any (array[
  'admin', 'direccion', 'finanzas', 'encargado_staff', 'coordinador_servidores',
  'coordinador_estudios', 'coordinador_dirigentes', 'encargado_eventos',
  'lider_comite', 'comunicaciones', 'dirigente', 'editor_perfiles', 'miembro',
  'solo_lectura', 'reportes', 'folletos', 'becas', 'revision_pagos',
  'editor_grupos_estudio', 'forms', 'evaluaciones', 'gestor_accesos',
  'solicitudes_estudio', 'solicitudes_puestos', 'aplicaciones_servicio'
]));
