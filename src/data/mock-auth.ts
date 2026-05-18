export type RoleId =
  | 'admin'
  | 'direccion'
  | 'finanzas'
  | 'encargado_staff'
  | 'coordinador_estudios'
  | 'coordinador_dirigentes'
  | 'lider_comite'
  | 'comunicaciones'
  | 'dirigente'
  | 'editor_perfiles'
  | 'miembro'
  | 'solo_lectura'

export type Permission = {
  module: string
  actions: ('view' | 'create' | 'edit' | 'delete' | 'export')[]
  scope?: 'own' | 'committee' | 'all'
}

export type Role = {
  id: RoleId
  name: string
  description: string
  color: string
  permissions: Permission[]
}

export type UserAccess = {
  id: string
  member_id: string
  member_name: string
  member_email: string
  member_initials: string
  roles: RoleId[]
  granted_by: string
  granted_at: string
  last_login: string | null
  is_active: boolean
  history?: AccessHistoryEntry[]
}

export type AccessHistoryEntry = {
  date: string
  actor: string
  action: 'assigned' | 'revoked'
  role: RoleId
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

export const MOCK_USER_ACCESS: UserAccess[] = [
  {
    id: 'access-001',
    member_id: 'uuid-0001',
    member_name: 'Alejandro Ruiz Moreno',
    member_email: 'alejandro.ruiz@gmail.com',
    member_initials: 'AR',
    roles: ['admin'],
    granted_by: 'Sistema',
    granted_at: '2024-01-10',
    last_login: '2026-05-17',
    is_active: true,
    history: [
      { date: '2024-01-10', actor: 'Sistema', action: 'assigned', role: 'admin' },
    ],
  },
  {
    id: 'access-002',
    member_id: 'uuid-0002',
    member_name: 'Sofía Fernández López',
    member_email: 'sofia.fernandez@outlook.com',
    member_initials: 'SF',
    roles: ['direccion'],
    granted_by: 'Admin Theos',
    granted_at: '2024-02-05',
    last_login: '2026-05-16',
    is_active: true,
    history: [
      { date: '2024-02-05', actor: 'Admin Theos', action: 'assigned', role: 'direccion' },
    ],
  },
  {
    id: 'access-003',
    member_id: 'uuid-0003',
    member_name: 'Marcos García Vidal',
    member_email: 'marcos.garcia@gmail.com',
    member_initials: 'MG',
    roles: ['coordinador_estudios'],
    granted_by: 'Sofía Fernández López',
    granted_at: '2024-03-14',
    last_login: '2026-05-12',
    is_active: true,
    history: [
      { date: '2024-03-14', actor: 'Sofía Fernández López', action: 'assigned', role: 'coordinador_estudios' },
    ],
  },
  {
    id: 'access-004',
    member_id: 'uuid-0004',
    member_name: 'Laura Martínez Ortiz',
    member_email: 'laura.martinez@gmail.com',
    member_initials: 'LM',
    roles: ['encargado_staff'],
    granted_by: 'Admin Theos',
    granted_at: '2024-04-22',
    last_login: '2026-05-10',
    is_active: true,
    history: [
      { date: '2024-04-22', actor: 'Admin Theos', action: 'assigned', role: 'encargado_staff' },
    ],
  },
  {
    id: 'access-005',
    member_id: 'uuid-0005',
    member_name: 'Daniel Torres Blanco',
    member_email: 'daniel.torres@icloud.com',
    member_initials: 'DT',
    roles: ['comunicaciones'],
    granted_by: 'Sofía Fernández López',
    granted_at: '2024-06-01',
    last_login: '2026-05-08',
    is_active: true,
    history: [
      { date: '2024-06-01', actor: 'Sofía Fernández López', action: 'assigned', role: 'comunicaciones' },
    ],
  },
  {
    id: 'access-006',
    member_id: 'uuid-0006',
    member_name: 'Valeria Sánchez Romero',
    member_email: 'valeria.sanchez@gmail.com',
    member_initials: 'VS',
    roles: ['coordinador_dirigentes', 'editor_perfiles'],
    granted_by: 'Admin Theos',
    granted_at: '2024-07-18',
    last_login: '2026-05-14',
    is_active: true,
    history: [
      { date: '2024-07-18', actor: 'Admin Theos', action: 'assigned', role: 'coordinador_dirigentes' },
      { date: '2025-01-09', actor: 'Admin Theos', action: 'assigned', role: 'editor_perfiles' },
    ],
  },
  {
    id: 'access-007',
    member_id: 'uuid-0007',
    member_name: 'Pablo Jiménez Cruz',
    member_email: 'pablo.jimenez@gmail.com',
    member_initials: 'PJ',
    roles: ['dirigente', 'lider_comite'],
    granted_by: 'Marcos García Vidal',
    granted_at: '2024-08-30',
    last_login: '2026-04-28',
    is_active: true,
    history: [
      { date: '2024-08-30', actor: 'Marcos García Vidal', action: 'assigned', role: 'dirigente' },
      { date: '2025-02-11', actor: 'Admin Theos', action: 'assigned', role: 'lider_comite' },
    ],
  },
  {
    id: 'access-008',
    member_id: 'uuid-0008',
    member_name: 'Carmen Delgado Nieto',
    member_email: 'carmen.delgado@hotmail.com',
    member_initials: 'CD',
    roles: ['editor_perfiles'],
    granted_by: 'Admin Theos',
    granted_at: '2024-09-05',
    last_login: '2026-05-01',
    is_active: true,
    history: [
      { date: '2024-09-05', actor: 'Admin Theos', action: 'assigned', role: 'editor_perfiles' },
    ],
  },
  {
    id: 'access-009',
    member_id: 'uuid-0009',
    member_name: 'Adriana Montero Quesada',
    member_email: 'adriana.montero@gmail.com',
    member_initials: 'AM',
    roles: ['finanzas'],
    granted_by: 'Sofía Fernández López',
    granted_at: '2024-10-17',
    last_login: '2026-05-15',
    is_active: true,
    history: [
      { date: '2024-10-17', actor: 'Sofía Fernández López', action: 'assigned', role: 'finanzas' },
    ],
  },
  {
    id: 'access-010',
    member_id: 'uuid-0010',
    member_name: 'Felipe Vargas Arias',
    member_email: 'felipe.vargas@ccss.sa.cr',
    member_initials: 'FV',
    roles: ['encargado_staff', 'coordinador_estudios'],
    granted_by: 'Admin Theos',
    granted_at: '2025-01-20',
    last_login: '2026-03-22',
    is_active: true,
    history: [
      { date: '2025-01-20', actor: 'Admin Theos', action: 'assigned', role: 'encargado_staff' },
      { date: '2025-03-05', actor: 'Admin Theos', action: 'assigned', role: 'coordinador_estudios' },
    ],
  },
  {
    id: 'access-011',
    member_id: 'uuid-0011',
    member_name: 'Isabella Mora Solís',
    member_email: 'isabella.mora@gmail.com',
    member_initials: 'IM',
    roles: ['comunicaciones', 'editor_perfiles'],
    granted_by: 'Sofía Fernández López',
    granted_at: '2025-02-28',
    last_login: '2026-05-13',
    is_active: true,
    history: [
      { date: '2025-02-28', actor: 'Sofía Fernández López', action: 'assigned', role: 'comunicaciones' },
      { date: '2025-04-01', actor: 'Sofía Fernández López', action: 'assigned', role: 'editor_perfiles' },
    ],
  },
  {
    id: 'access-012',
    member_id: 'uuid-0012',
    member_name: 'Diego Herrera Calvo',
    member_email: 'diego.herrera@gmail.com',
    member_initials: 'DH',
    roles: ['solo_lectura'],
    granted_by: 'Admin Theos',
    granted_at: '2025-03-10',
    last_login: null,
    is_active: false,
    history: [
      { date: '2025-03-10', actor: 'Admin Theos', action: 'assigned', role: 'solo_lectura' },
      { date: '2025-11-30', actor: 'Admin Theos', action: 'revoked', role: 'solo_lectura' },
      { date: '2025-11-30', actor: 'Admin Theos', action: 'assigned', role: 'solo_lectura' },
    ],
  },
  {
    id: 'access-013',
    member_id: 'custom-001',
    member_name: 'Jennifer Zamora',
    member_email: 'finanzas@theosplace.org',
    member_initials: 'JZ',
    roles: ['finanzas'],
    granted_by: 'Admin Theos',
    granted_at: '2024-01-10',
    last_login: '2026-05-16',
    is_active: true,
    history: [
      { date: '2024-01-10', actor: 'Sistema', action: 'assigned', role: 'finanzas' },
    ],
  },
  {
    id: 'access-014',
    member_id: 'custom-002',
    member_name: 'Carlos Araya',
    member_email: 'staff@theosplace.org',
    member_initials: 'CA',
    roles: ['encargado_staff'],
    granted_by: 'Admin Theos',
    granted_at: '2024-01-10',
    last_login: '2026-05-09',
    is_active: true,
    history: [
      { date: '2024-01-10', actor: 'Sistema', action: 'assigned', role: 'encargado_staff' },
    ],
  },
  {
    id: 'access-015',
    member_id: 'custom-003',
    member_name: 'Roberto Salas Jiménez',
    member_email: 'roberto.salas@gmail.com',
    member_initials: 'RS',
    roles: ['miembro'],
    granted_by: 'Sistema',
    granted_at: '2026-01-03',
    last_login: null,
    is_active: true,
    history: [
      { date: '2026-01-03', actor: 'Sistema', action: 'assigned', role: 'miembro' },
    ],
  },
]
