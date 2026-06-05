// Types live in @/types/auth — imported here for internal use, re-exported for consumers.
import type { RoleId, Permission, Role, UserAccess, AccessHistoryEntry } from '@/types/auth'
export type { RoleId, Permission, Role, UserAccess, AccessHistoryEntry }

// Orden de menor a mayor privilegio
export const ROLES: Role[] = [
  {
    id: 'miembro',
    name: 'Miembro',
    description: 'Solo su perfil, sus grupos y su familia',
    color: '#9CA0B4',
    permissions: [
      { module: 'miembros', actions: ['view'], scope: 'own' },
      { module: 'estudios', actions: ['view'], scope: 'own' },
    ],
  },
  {
    id: 'solo_lectura',
    name: 'Solo lectura',
    description: 'Ver todo el sistema, sin editar nada',
    color: '#C9CCD9',
    permissions: [
      { module: 'all', actions: ['view'], scope: 'all' },
    ],
  },
  {
    id: 'editor_perfiles',
    name: 'Editor de Perfiles',
    description: 'Crear y editar perfiles de miembros',
    color: '#E9B949',
    permissions: [
      { module: 'miembros', actions: ['view', 'create', 'edit'], scope: 'all' },
    ],
  },
  {
    id: 'comunicaciones',
    name: 'Comunicaciones',
    description: 'Envío de mensajes y ver miembros',
    color: '#F78382',
    permissions: [
      { module: 'comunicaciones', actions: ['view', 'create', 'edit'], scope: 'all' },
      { module: 'miembros',       actions: ['view'],                   scope: 'all' },
    ],
  },
  {
    id: 'lider_comite',
    name: 'Líder de Comité',
    description: 'Su comité y sus miembros',
    color: '#EF5554',
    permissions: [
      { module: 'servidores', actions: ['view', 'edit'], scope: 'committee' },
      { module: 'miembros',   actions: ['view'],         scope: 'committee' },
    ],
  },
  {
    id: 'dirigente',
    name: 'Dirigente',
    description: 'Sus grupos actuales e históricos + detalle de sus estudiantes',
    color: '#9B7FD4',
    permissions: [
      { module: 'estudios', actions: ['view', 'edit'], scope: 'own' },
      { module: 'miembros', actions: ['view'],         scope: 'own' },
    ],
  },
  {
    id: 'coordinador_dirigentes',
    name: 'Coordinador de Dirigentes',
    description: 'Dirigentes y grupos, sin crear tipos de estudio',
    color: '#B5DDE0',
    permissions: [
      { module: 'estudios', actions: ['view', 'edit'], scope: 'all' },
      { module: 'miembros', actions: ['view'],         scope: 'all' },
    ],
  },
  {
    id: 'coordinador_estudios',
    name: 'Coordinador de Estudios',
    description: 'Estudios, dirigentes y grupos',
    color: '#519DA2',
    permissions: [
      { module: 'estudios', actions: ['view', 'create', 'edit', 'export'], scope: 'all' },
      { module: 'miembros', actions: ['view'],                             scope: 'all' },
    ],
  },
  {
    id: 'encargado_staff',
    name: 'Encargado de Staff',
    description: 'Servidores, vacantes y empleados',
    color: '#70BDC2',
    permissions: [
      { module: 'servidores', actions: ['view', 'create', 'edit', 'export'], scope: 'all' },
      { module: 'empleados',  actions: ['view', 'create', 'edit'],           scope: 'all' },
      { module: 'miembros',   actions: ['view'],                             scope: 'all' },
    ],
  },
  {
    id: 'finanzas',
    name: 'Finanzas',
    description: 'Módulo de finanzas + ver perfiles sin montos',
    color: '#3DB97A',
    permissions: [
      { module: 'finanzas', actions: ['view', 'create', 'edit', 'export'], scope: 'all' },
      { module: 'miembros', actions: ['view'],                             scope: 'all' },
    ],
  },
  {
    id: 'direccion',
    name: 'Dirección',
    description: 'Todo el sistema excepto configuración técnica',
    color: '#29365C',
    permissions: [
      { module: 'miembros',       actions: ['view', 'create', 'edit', 'export'], scope: 'all' },
      { module: 'estudios',       actions: ['view', 'create', 'edit', 'export'], scope: 'all' },
      { module: 'eventos',        actions: ['view', 'create', 'edit', 'export'], scope: 'all' },
      { module: 'servidores',     actions: ['view', 'create', 'edit', 'export'], scope: 'all' },
      { module: 'empleados',      actions: ['view', 'create', 'edit', 'export'], scope: 'all' },
      { module: 'finanzas',       actions: ['view', 'export'],                   scope: 'all' },
      { module: 'comunicaciones', actions: ['view', 'create'],                   scope: 'all' },
      { module: 'formularios',    actions: ['view', 'create', 'edit'],           scope: 'all' },
      { module: 'accesos',        actions: ['view'],                             scope: 'all' },
    ],
  },
  {
    id: 'admin',
    name: 'Administrador',
    description: 'Acceso completo a todo el sistema',
    color: '#161440',
    permissions: [{ module: 'all', actions: ['view', 'create', 'edit', 'delete', 'export'], scope: 'all' }],
  },
]

export const DEFAULT_ROLE: RoleId = 'miembro'

// Datos de acceso hardcodeados eliminados: los usuarios reales viven en Supabase Auth
// (auth.users + members.auth_user_id + member_roles). Se mantiene el export vacío
// para los tipos/consumidores existentes.
export const MOCK_USER_ACCESS: UserAccess[] = []
