-- Rol nuevo 'reportes' (acceso a todos los reportes) + sincronizar el CHECK de
-- member_roles.role con todos los RoleId del código (incluía valores faltantes:
-- coordinador_servidores, encargado_eventos).
alter table member_roles drop constraint if exists member_roles_role_check;
alter table member_roles add constraint member_roles_role_check check (role = any (array[
  'admin','direccion','finanzas','encargado_staff','coordinador_servidores',
  'coordinador_estudios','coordinador_dirigentes','encargado_eventos','lider_comite',
  'comunicaciones','dirigente','editor_perfiles','miembro','solo_lectura','reportes'
]));
