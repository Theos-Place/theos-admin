// Qué se puede hacer con un formulario según su estado (puro: server + cliente).
//
// El lenguaje: un formulario NO se "archiva", se DESACTIVA — y se vuelve a
// publicar. "Archivar" sonaba definitivo y en realidad solo apaga el is_active.
//
// Eliminar es lo único irreversible y pide DOS condiciones (regla 2026-08-07):
//  · desactivado — que nadie borre de un clic algo que se está llenando ahora;
//  · sin respuestas — lo que la gente contestó no se tira por una pantalla de
//    gestión. Un formulario con respuestas se desactiva y se queda ahí.

export type FormEstado = { is_active: boolean; responses_count: number }

/** Quién puede BORRAR un formulario. Es más acotado que editarlo: el rol 'forms'
 *  (ver/crear/editar/exportar) no alcanza.
 *  Fuente única — la usan el endpoint y el menú de la lista.
 *
 *  'admin' está incluido desde 2026-08-07: no hay bypass automático por ser
 *  admin en este sistema (cada guard lista sus roles), así que sin ponerlo acá
 *  TI no veía la opción de eliminar y tampoco habría podido usar el endpoint. */
export const FORM_DELETE_ROLES = ['admin', 'comunicaciones', 'direccion', 'encargado_staff'] as const

export function canUserDeleteForms(roles: readonly string[] | undefined): boolean {
  return (roles ?? []).some(r => (FORM_DELETE_ROLES as readonly string[]).includes(r))
}

export type FormActionError = 'form_activo' | 'form_con_respuestas'

export const FORM_ACTION_MESSAGES: Record<FormActionError, string> = {
  form_activo: 'El formulario está activo. Desactivalo antes de eliminarlo.',
  form_con_respuestas: 'El formulario ya tiene respuestas. Se puede desactivar, pero no eliminar.',
}

/** ¿Se puede eliminar? Desactivado Y sin una sola respuesta. */
export function canDeleteForm(f: FormEstado): boolean {
  return !f.is_active && f.responses_count === 0
}

/** Por qué NO se puede eliminar (para explicarlo en la UI). null = sí se puede. */
export function deleteBlockedReason(f: FormEstado): FormActionError | null {
  if (f.is_active) return 'form_activo'
  if (f.responses_count > 0) return 'form_con_respuestas'
  return null
}

/** ¿Se puede publicar (activar)? Solo si está desactivado. */
export function canPublishForm(f: FormEstado): boolean {
  return !f.is_active
}

/** Lo que se dice antes de borrar. Un formulario borrable no tiene respuestas
 *  (ver canDeleteForm), así que no hay nada que se pierda salvo el formulario:
 *  eso se dice tal cual, sin un "esta acción es irreversible" que nadie lee. */
export function deleteWarning(f: FormEstado): string {
  return f.responses_count > 0
    ? FORM_ACTION_MESSAGES.form_con_respuestas
    : 'Se elimina el formulario y sus preguntas. No tiene respuestas, así que no se pierde nada más.'
}

/** Filtro por estado de la lista. */
export type EstadoFilter = 'all' | 'active' | 'inactive'

export const ESTADO_FILTERS: { key: EstadoFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'active', label: 'Activos' },
  { key: 'inactive', label: 'Inactivos' },
]

export function matchesEstado(f: { is_active: boolean }, filtro: EstadoFilter): boolean {
  if (filtro === 'all') return true
  return filtro === 'active' ? f.is_active : !f.is_active
}
