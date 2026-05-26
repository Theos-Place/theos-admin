// Access control / roles domain types.

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
