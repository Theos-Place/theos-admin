// Qué se puede hacer con un formulario según su estado (puro: server + cliente).
//
// El lenguaje: un formulario NO se "archiva", se DESACTIVA — y se vuelve a
// publicar. "Archivar" sonaba definitivo y en realidad solo apaga el is_active.
//
// Eliminar es lo único irreversible: solo si está DESACTIVADO, para que nadie
// borre de un clic algo que la gente está llenando en este momento. Si además
// tiene respuestas, se borran con él y hay que decirlo antes, no después.

export type FormEstado = { is_active: boolean; responses_count: number }

/** Quién puede BORRAR un formulario. Es más acotado que editarlo: el borrado se
 *  lleva las respuestas por delante, así que el rol 'forms' no alcanza.
 *  Fuente única — la usan el endpoint y el menú de la lista. */
export const FORM_DELETE_ROLES = ['comunicaciones', 'direccion', 'encargado_staff'] as const

export function canUserDeleteForms(roles: readonly string[] | undefined): boolean {
  return (roles ?? []).some(r => (FORM_DELETE_ROLES as readonly string[]).includes(r))
}

export type FormActionError = 'form_activo'

export const FORM_ACTION_MESSAGES: Record<FormActionError, string> = {
  form_activo: 'El formulario está activo. Desactivalo antes de eliminarlo.',
}

/** ¿Se puede eliminar? Solo estando desactivado. */
export function canDeleteForm(f: FormEstado): boolean {
  return !f.is_active
}

/** ¿Se puede publicar (activar)? Solo si está desactivado. */
export function canPublishForm(f: FormEstado): boolean {
  return !f.is_active
}

/** Lo que hay que advertir ANTES de borrar. null = nada que advertir.
 *  Las respuestas se van con el formulario: eso se dice con el número, no con
 *  un "esta acción es irreversible" genérico que nadie lee. */
export function deleteWarning(f: FormEstado): string | null {
  if (f.responses_count <= 0) return null
  return f.responses_count === 1
    ? 'Se va a borrar también la respuesta que ya recibió. No se puede deshacer.'
    : `Se van a borrar también las ${f.responses_count} respuestas que ya recibió. No se puede deshacer.`
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
