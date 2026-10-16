// Access control / roles domain types.

export type RoleId =
  | 'admin'
  | 'direccion'
  | 'finanzas'
  /** FIN-12 · Colaborador de Finanzas de una sede: registra los adelantos de comida. Rol automático por puesto. */
  | 'colaborador_finanzas'
  /** SOP-1 · Resuelve los tiquetes de soporte que levanta la puerta. Rol automático por el puesto «Soporte Técnico» de TI. */
  | 'soporte_tecnico'
  | 'recursos'
  | 'encargado_staff'
  | 'coordinador_servidores'
  | 'coordinador_estudios'
  | 'coordinador_dirigentes'
  | 'encargado_eventos'
  | 'lider_comite'
  | 'comunicaciones'
  | 'dirigente'
  | 'editor_perfiles'
  | 'miembro'
  | 'solo_lectura'
  | 'reportes'
  | 'folletos'
  | 'revision_pagos'
  | 'becas'
  | 'editor_grupos_estudio'
  | 'editor_dirigentes'
  /**
   * DIR-8 · Lectura de las notas confidenciales del dirigente, sin poder
   * editarlas (Luis y Yeya). Existe porque `editor_dirigentes` actualiza
   * datos todos los días y NO debe ver las notas: sin este rol, dar lectura
   * obligaba a dar edición.
   */
  | 'lector_dirigentes'  
  | 'forms'
  | 'evaluaciones'
  | 'gestor_accesos'
  | 'solicitudes_estudio'
  | 'solicitudes_puestos'
  | 'aplicaciones_servicio'
  /**
   * SRV · El rol UNIFICADO del comité de servidores (2026-10-07). Reemplaza a
   * `solicitudes_puestos` y `aplicaciones_servicio`, que tenían permisos
   * idénticos y solo se diferenciaban en los guards de las rutas. Los dos
   * quedan en el tipo porque sus filas viejas siguen en la base, apagadas.
   */
  | 'puestos_servicio'

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
  /** origen ('manual'|'automatico') de cada rol activo — para mostrar de dónde
   *  viene un rol (asignado a mano vs. otorgado por un puesto de servicio). */
  role_origins?: Partial<Record<RoleId, 'manual' | 'automatico'>>
  /** Cantidad de puestos activos que respaldan un rol automático. */
  role_position_counts?: Partial<Record<RoleId, number>>
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
