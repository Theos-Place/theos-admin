// FEA-1: regla pura de cuándo notificar la asignación de un formulario.
// Se notifica solo si el form está activo, tiene entidad real (evento o grupo)
// y esa asignación no fue notificada antes (dedupe por clave persistida).

export type AssignmentSnapshot = {
  is_active: boolean
  entity_type: 'event' | 'study_group' | 'general' | null
  entity_id: string | null
  assignment_notified_key: string | null
}

export function assignmentKey(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`
}

export function shouldNotifyAssignment(f: AssignmentSnapshot): { notify: boolean; key?: string } {
  if (!f.is_active) return { notify: false }
  if (!f.entity_type || f.entity_type === 'general' || !f.entity_id) return { notify: false }
  const key = assignmentKey(f.entity_type, f.entity_id)
  if (f.assignment_notified_key === key) return { notify: false }
  return { notify: true, key }
}
