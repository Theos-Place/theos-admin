-- SRV-11 · Rol nuevo: `solicitudes_puestos`.
--
-- QUÉ ABRE. La pantalla «Solicitar puestos de servicio» vista COMO cualquier
-- líder —eligiendo el comité arriba— y, más adelante, la cola de solicitudes
-- (SRV-12). Hasta hoy esa pantalla la abrían el líder de SU comité y los roles
-- globales de servicio, y no había forma de darle ese trabajo a alguien del
-- comité de servidores sin convertirlo en coordinador de todo.
--
-- LO OTORGA UN PUESTO QUE YA EXISTE: «Colaborador Solicitud Puestos», del
-- Comité de Servidores (Área de Staff). El nombre se verificó en el catálogo
-- ANTES de escribir la regla, y por eso importa: el pedido lo llamaba
-- «Colaborador de solicitud de puestos», que no es como está guardado. Una
-- regla escrita contra el nombre del pedido no habría matcheado a nadie y el
-- fallo habría sido silencioso — la persona simplemente no vería la pantalla.
-- Hoy lo tiene 1 persona.

alter table member_roles drop constraint if exists member_roles_role_check;

alter table member_roles add constraint member_roles_role_check check (role = any (array[
  'admin', 'direccion', 'finanzas', 'encargado_staff', 'coordinador_servidores',
  'coordinador_estudios', 'coordinador_dirigentes', 'encargado_eventos',
  'lider_comite', 'comunicaciones', 'dirigente', 'editor_perfiles', 'miembro',
  'solo_lectura', 'reportes', 'folletos', 'becas', 'revision_pagos',
  'editor_grupos_estudio', 'forms', 'evaluaciones', 'gestor_accesos',
  'solicitudes_estudio', 'solicitudes_puestos'
]));
