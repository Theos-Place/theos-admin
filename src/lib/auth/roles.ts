// Fuente de verdad de los permisos por rol (cliente via usePermissions y
// servidor via requireModuleView). Antes vivía en src/data/mock-auth.ts.
import type { RoleId, Permission, Role, UserAccess, AccessHistoryEntry } from '@/types/auth'
export type { RoleId, Permission, Role, UserAccess, AccessHistoryEntry }

/** Roles con acceso completo a estudios (gestión del plan, detalle de grupos,
 *  crear/editar tipos de estudio). 'dirigente' y 'miembro' quedan fuera: solo
 *  ven el currículo público. Reutilizar en guards de UI y de API. */
export const STUDY_ADMIN_ROLES: RoleId[] = [
  'coordinador_estudios', 'coordinador_dirigentes', 'direccion', 'admin',
]

/** Roles que pueden crear/editar/eliminar GRUPOS de estudio. Es STUDY_ADMIN más
 *  el rol acotado 'editor_grupos_estudio' (solo grupos, nada más de estudios).
 *  Reutilizar en los guards de UI y de API de grupos (crear/editar/eliminar). */
export const GROUP_ADMIN_ROLES: RoleId[] = [...STUDY_ADMIN_ROLES, 'editor_grupos_estudio']

/** DIR-5 · Quiénes entran a la cola de evaluaciones del dirigente.
 *
 *  Lista corta y a propósito: 'direccion' NO está, aunque sí esté en
 *  STUDY_ADMIN_ROLES. La retro de un dirigente es material sensible y quién la
 *  ve se decide explícito, no se hereda por ser el rol más alto de estudios.
 *  Tampoco 'coordinador_estudios': el dueño de este proceso es dirigentes. */
export const EVALUATION_ROLES: RoleId[] = ['evaluaciones', 'coordinador_dirigentes', 'admin']

/**
 * ¿Estos roles alcanzan SOLO la sección de grupos dentro de estudios?
 * El rol 'editor_grupos_estudio' tiene el módulo `estudios` con alcance 'all'
 * (lo necesita para ver el listado y el detalle de cualquier grupo), pero eso
 * NO lo habilita al resto del módulo: plan, bloques, dirigentes, análisis,
 * solicitudes y folletos son de STUDY_ADMIN_ROLES.
 *
 * Falso si además trae un rol que sí abre estudios completo (coordinadores,
 * dirección, admin) o 'solo_lectura' (que ve todo por el módulo 'all').
 * Fuente única para el sidebar, el ModuleGuard de las páginas y los guards de
 * API que hoy se apoyan en el permiso de módulo.
 */
export function isStudyGroupsOnly(roles: readonly RoleId[] | null | undefined): boolean {
  const list = roles ?? []
  if (!list.includes('editor_grupos_estudio')) return false
  return !list.some(r => STUDY_ADMIN_ROLES.includes(r) || r === 'solo_lectura')
}

/** Delegación acotada de permisos: el coordinador de estudios puede asignar/quitar
 *  SOLO estos tres roles a otras personas (poder de administración acotado). El
 *  resto de los permisos siguen siendo exclusivos de 'admin'. Fuente única para
 *  UI y validación server-side — no escalable a otros roles. */
export const COORDINADOR_ESTUDIOS_DELEGABLE: RoleId[] = [
  'editor_perfiles', 'editor_grupos_estudio', 'folletos',
]

/** Qué roles puede asignar/quitar un actor según SUS roles:
 *   · 'all'  → admin: cualquiera.
 *   · Set    → coordinador_estudios: solo los delegados.
 *   · Set()  → nadie (sin permiso de gestión de accesos).
 *  La usan el endpoint de accesos (server) y la UI de accesos (para filtrar). */
export function assignableRoleIds(actorRoles: RoleId[]): 'all' | Set<RoleId> {
  if (actorRoles.includes('admin')) return 'all'
  if (actorRoles.includes('coordinador_estudios')) return new Set(COORDINADOR_ESTUDIOS_DELEGABLE)
  return new Set<RoleId>()
}

/** Roles que administran servidores: comités, áreas, puestos y aplicaciones
 *  (mantenimiento CRUD, importación, asignación de responsables). Reutilizar en
 *  guards de UI (usePermissions/hasRole) y de API (requireRoles). */
export const SERVICE_ADMIN_ROLES: RoleId[] = [
  'encargado_staff', 'coordinador_servidores', 'direccion', 'admin',
]

/** "Coordinación de staff": roles que pueden IMPORTAR puestos/vacantes y solicitar
 *  puestos nuevos para cualquier comité. Subconjunto de SERVICE_ADMIN_ROLES que
 *  EXCLUYE 'direccion' a propósito (decisión 2026-06-25: la importación y la
 *  solicitud global son de staff, no de dirección). 'admin' pasa siempre aparte. */
export const STAFF_IMPORT_ROLES: RoleId[] = ['encargado_staff', 'coordinador_servidores']

/** Roles que NO son de gestión: el rol base 'miembro' (autoservicio de su propio
 *  perfil). Todo lo demás implica trabajar algo del sistema para otras personas.
 *  Se agregó para el centro de ayuda (visibilidad 'gestion'), que necesita
 *  distinguir "cualquier persona con sesión" de "cualquier persona que gestiona". */
export const SELF_SERVICE_ROLES: RoleId[] = ['miembro']

/** El rol MÍNIMO de cualquier persona con ficha: ver su propio perfil, el de su
 *  familia y el currículo (/estudios/plan). Nadie lo tiene escrito en
 *  member_roles —el alta de cuentas no asigna roles— así que la garantía no
 *  puede vivir en los datos: se aplica acá, al leer.
 *
 *  Por qué una función y no la expresión suelta: el default estaba copiado en
 *  getAuthContext() y en /api/auth/me, sin test. Dos copias de un invariante es
 *  tenerlo mal en una de las dos en cuanto alguien agregue un tercer lector.
 *  Este es el único lugar donde se decide, y `base-role.test.ts` lo fija.
 *
 *  Ojo con el caso que NO cubre, y es a propósito: una sesión de Auth sin ficha
 *  de miembro no recibe el rol base. Sin ficha no hay perfil propio que ver, y
 *  darle 'miembro' la dejaría entrar a una pantalla sin datos. */
export function withBaseRole(roles: readonly RoleId[] | null | undefined): RoleId[] {
  const explicitos = (roles ?? []).filter(Boolean)
  return explicitos.length ? [...explicitos] : ['miembro']
}

/** ¿Alguno de estos roles es de gestión (algo más que el autoservicio)? */
export function hasManagementRole(roleIds: readonly RoleId[] | null | undefined): boolean {
  return (roleIds ?? []).some(r => !SELF_SERVICE_ROLES.includes(r))
}

/** Roles que operan el check-in y los reportes de eventos (ver detalle, hacer
 *  check-in, exportar). Reutilizar en guards de UI (usePermissions/hasRole) y de
 *  API (requireRoles) de eventos/check-in/reportes. */
export const EVENT_CHECKIN_ROLES: RoleId[] = ['encargado_eventos', 'direccion', 'admin']

/**
 * Alcance efectivo de un módulo para un set de roles (espejo server-side de
 * getScope() del cliente): el más amplio gana. null = sin el módulo.
 * SEC-1: lo usan endpoints que deben acotar el payload por alcance
 * (p. ej. lider_comite ve solo SUS comités en /api/servers/committees).
 */
export function moduleScope(roleIds: RoleId[], module: string): 'all' | 'committee' | 'own' | null {
  const scopes = roleIds.flatMap(roleId => {
    const role = ROLES.find(r => r.id === roleId)
    if (!role) return []
    return role.permissions
      .filter(p => p.module === module || p.module === 'all')
      .map(p => p.scope ?? 'all')
  })
  if (scopes.includes('all')) return 'all'
  if (scopes.includes('committee')) return 'committee'
  if (scopes.includes('own')) return 'own'
  return null
}

/**
 * ¿Alguno de los roles otorga `action` sobre alguno de los `modules`?
 * Lógica pura compartida por el guard server-side (requireModuleView) y
 * testeable sin Supabase. `modules` acepta uno o varios (semántica any-of:
 * REV-3 usa ['finanzas','revision_pagos'] para la página unificada de pagos).
 * `beyondOwn` excluye permisos con scope 'own' (espejo del guard).
 */
export function hasModulePermission(
  roleIds: RoleId[],
  modules: string | string[],
  action: string = 'view',
  opts: { beyondOwn?: boolean } = {},
): boolean {
  const wanted = Array.isArray(modules) ? modules : [modules]
  return roleIds.some(roleId => {
    const role = ROLES.find(r => r.id === roleId)
    return role?.permissions.some(p =>
      (p.module === 'all' || wanted.includes(p.module))
      && p.actions.includes(action as never)
      && (!opts.beyondOwn || p.scope !== 'own'))
  })
}

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
    id: 'reportes',
    name: 'Reportes',
    description: 'Acceso a todos los reportes del sistema',
    color: '#7FB2D4',
    permissions: [
      { module: 'reportes', actions: ['view', 'export'], scope: 'all' },
    ],
  },
  {
    id: 'folletos',
    name: 'Folletos',
    description: 'Gestión y seguimiento de folletos de estudios',
    color: '#7FB2D4',
    permissions: [
      { module: 'folletos', actions: ['view', 'edit'], scope: 'all' },
      { module: 'revision_pagos', actions: ['view', 'edit'], scope: 'all' },
    ],
  },
  {
    id: 'revision_pagos',
    name: 'Revisión de pagos',
    description: 'Revisar y aprobar/rechazar pagos por comprobante',
    color: '#3DB97A',
    permissions: [
      { module: 'revision_pagos', actions: ['view', 'edit'], scope: 'all' },
    ],
  },
  {
    id: 'becas',
    name: 'Becas',
    description: 'Gestión de becas y cupones de descuento',
    color: '#3DB97A',
    permissions: [
      { module: 'becas', actions: ['view', 'edit'], scope: 'all' },
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
    id: 'editor_grupos_estudio',
    name: 'Editor de Grupos de Estudio',
    description: 'Ver, crear, editar y eliminar grupos de estudio',
    color: '#3B7579',
    // Solo 'view' a nivel módulo (para ver la sección/detalle de grupos). El
    // crear/editar/eliminar se autoriza por rol explícito (GROUP_ADMIN_ROLES) en
    // los endpoints de grupos, así el poder queda acotado a grupos y no se
    // extiende al plan ni a los tipos de estudio.
    permissions: [
      { module: 'estudios', actions: ['view'], scope: 'all' },
    ],
  },
  {
    id: 'forms',
    name: 'Formularios',
    description: 'Todos los formularios y sus respuestas (ver, crear, editar, exportar)',
    color: '#9B7FD4',
    // El módulo completo, sin 'delete': borrar un formulario (con sus respuestas
    // detrás) sigue siendo de comunicaciones/staff/dirección/admin.
    permissions: [
      { module: 'formularios', actions: ['view', 'create', 'edit', 'export'], scope: 'all' },
    ],
  },
  {
    id: 'evaluaciones',
    name: 'Evaluaciones de dirigentes',
    description: 'Revisar el compilado de las evaluaciones y compartirlo con el dirigente',
    color: '#7FA8D4',
    // Rol acotado: solo la cola de evaluaciones. No abre el resto de estudios.
    permissions: [
      { module: 'evaluaciones', actions: ['view', 'edit'], scope: 'all' },
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
      // 2026-08-04: ya podía crear/editar formularios por rol explícito en
      // /api/forms pero no veía el listado ni las respuestas. Se alinea.
      { module: 'formularios',    actions: ['view', 'create', 'edit', 'export'], scope: 'all' },
    ],
  },
  {
    id: 'lider_comite',
    name: 'Líder de Comité',
    description: 'Su comité y sus miembros',
    color: '#C43635',
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
      { module: 'reportes', actions: ['view', 'export'], scope: 'all' },
      { module: 'revision_pagos', actions: ['view', 'edit'], scope: 'all' },
    ],
  },
  {
    id: 'coordinador_estudios',
    name: 'Coordinador de Estudios',
    description: 'Estudios, dirigentes y grupos',
    color: '#3B7579',
    permissions: [
      { module: 'estudios', actions: ['view', 'create', 'edit', 'export'], scope: 'all' },
      { module: 'miembros', actions: ['view'],                             scope: 'all' },
      { module: 'reportes', actions: ['view', 'export'],                   scope: 'all' },
      { module: 'revision_pagos', actions: ['view', 'edit'],               scope: 'all' },
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
      // 2026-08-04: mismo desalineamiento que comunicaciones (ver arriba).
      { module: 'formularios', actions: ['view', 'create', 'edit', 'export'], scope: 'all' },
    ],
  },
  {
    id: 'coordinador_servidores',
    name: 'Coordinador de Servidores',
    description: 'Comités, áreas, puestos y aplicaciones de servicio',
    color: '#7FB2D4',
    permissions: [
      { module: 'servidores', actions: ['view', 'create', 'edit'], scope: 'all' },
      { module: 'miembros',   actions: ['view'],                   scope: 'all' },
      { module: 'reportes',   actions: ['view', 'export'],         scope: 'all' },
    ],
  },
  {
    id: 'encargado_eventos',
    name: 'Encargado de Eventos / Check-in',
    description: 'Check-in de eventos, reportes y detalle. Sin otros módulos',
    color: '#E0823D',
    permissions: [
      // view = ver detalle/check-in/reportes; edit = hacer check-in; export = reportes.
      { module: 'eventos', actions: ['view', 'edit', 'export'], scope: 'all' },
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
      { module: 'revision_pagos', actions: ['view', 'edit'],               scope: 'all' },
      { module: 'becas', actions: ['view', 'edit'],                        scope: 'all' },
    ],
  },
  {
    id: 'direccion',
    name: 'Dirección',
    description: 'Todo el sistema excepto configuración técnica',
    color: '#29365C',
    permissions: [
      // Todos los módulos del sistema, todas las acciones EXCEPTO delete.
      // Excluido a propósito: 'accesos' (solo admin — el mapa de privilegios no se
      // expone a dirección, decisión 2026-06-11). 'delete' queda solo para admin.
      { module: 'miembros',       actions: ['view', 'create', 'edit', 'export'], scope: 'all' },
      { module: 'estudios',       actions: ['view', 'create', 'edit', 'export'], scope: 'all' },
      { module: 'eventos',        actions: ['view', 'create', 'edit', 'export'], scope: 'all' },
      { module: 'servidores',     actions: ['view', 'create', 'edit', 'export'], scope: 'all' },
      { module: 'empleados',      actions: ['view', 'create', 'edit', 'export'], scope: 'all' },
      { module: 'finanzas',       actions: ['view', 'create', 'edit', 'export'], scope: 'all' },
      { module: 'comunicaciones', actions: ['view', 'create', 'edit', 'export'], scope: 'all' },
      { module: 'formularios',    actions: ['view', 'create', 'edit', 'export'], scope: 'all' },
      { module: 'reportes',       actions: ['view', 'export'],                   scope: 'all' },
      { module: 'revision_pagos', actions: ['view', 'edit'],                     scope: 'all' },
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
