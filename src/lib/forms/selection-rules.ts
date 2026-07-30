// EST-10: reglas puras de la revisión/selección del comité sobre un formulario
// de preinscripción (CDEB, Hermenéutica). Sin Supabase: las consume TANTO la
// pantalla como los endpoints, para que el gate y las decisiones sean las mismas
// en cliente y servidor.

/** Quién puede ver y decidir. Las respuestas traen testimonio y luchas
 *  personales: NO se abren a otros roles (ni a direccion). */
export const SELECTION_REVIEW_ROLES = ['coordinador_dirigentes', 'coordinador_estudios', 'admin'] as const

export type SelectionStatus = 'pendiente' | 'aprobado' | 'lista_espera' | 'rechazado'

export const SELECTION_STATUSES: SelectionStatus[] = ['pendiente', 'aprobado', 'lista_espera', 'rechazado']

export const SELECTION_STATUS_LABEL: Record<SelectionStatus, string> = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  lista_espera: 'Lista de espera',
  rechazado: 'No seleccionado',
}

export function isSelectionStatus(v: unknown): v is SelectionStatus {
  return typeof v === 'string' && (SELECTION_STATUSES as string[]).includes(v)
}

// ── Identificación del formulario y de sus campos clave ──────────────────────
// El formulario de preinscripción se reconoce por la pregunta de grupo con
// opciones dinámicas: su `options_source_param` es el code del plan (CDEB, HER).
// Así la pantalla sirve para cualquier convocatoria sin nada hardcodeado.

export type SelectionField = {
  id: string
  type: string
  label: string
  options_source?: string | null
  options_source_param?: string | null
}

/** Code del plan de la convocatoria, o null si el form no es de preinscripción. */
export function selectionPlanCode(fields: SelectionField[]): string | null {
  const f = fields.find(f => f.options_source === 'study_groups_open')
  return f?.options_source_param?.trim().toUpperCase() || null
}

export function isSelectionForm(fields: SelectionField[]): boolean {
  return selectionPlanCode(fields) !== null
}

/** Ids de los campos que alimentan los filtros del comité. La declaración
 *  doctrinal se detecta por la palabra "doctrinal" en la pregunta; la otra
 *  pregunta de sí/no es la de disponibilidad (así están escritas en el seed). */
export function selectionFieldIds(fields: SelectionField[]): {
  doctrine: string | null
  availability: string | null
  group: string | null
} {
  const yesNo = fields.filter(f => f.type === 'yes_no')
  const doctrine = yesNo.find(f => /doctrinal/i.test(f.label)) ?? null
  const availability = yesNo.find(f => f.id !== doctrine?.id) ?? null
  const group = fields.find(f => f.options_source === 'study_groups_open') ?? null
  return { doctrine: doctrine?.id ?? null, availability: availability?.id ?? null, group: group?.id ?? null }
}

/** Normaliza una respuesta de sí/no a booleano (null si no contestó). */
export function toYesNo(answer: unknown): boolean | null {
  if (answer === true || answer === false) return answer
  const s = String(answer ?? '').trim().toLowerCase()
  if (!s) return null
  if (s === 'sí' || s === 'si' || s === 'yes' || s === 'true') return true
  if (s === 'no' || s === 'false') return false
  return null
}

// ── Filas de la pantalla ────────────────────────────────────────────────────

export type SelectionRow = {
  response_id: string
  member_id: string | null
  member_name: string
  submitted_at: string
  status: SelectionStatus
  notes: string | null
  invited_at: string | null
  /** Derivados de las respuestas, para filtrar sin abrir cada detalle. */
  agrees_doctrine: boolean | null
  available: boolean | null
  chosen_group: string | null
  /** Recomendación de EST-9 del cierre de su estudio previo, si existe. */
  recommendation: string | null
}

export type SelectionFilters = {
  status?: SelectionStatus | 'todos'
  doctrine?: 'todos' | 'si' | 'no'
  availability?: 'todos' | 'si' | 'no'
  group?: string
  q?: string
}

const matchTri = (value: boolean | null, filter: 'todos' | 'si' | 'no' | undefined) =>
  !filter || filter === 'todos' ? true : filter === 'si' ? value === true : value === false

export function filterSelectionRows(rows: SelectionRow[], f: SelectionFilters): SelectionRow[] {
  const q = (f.q ?? '').trim().toLowerCase()
  return rows.filter(r =>
    (!f.status || f.status === 'todos' || r.status === f.status) &&
    matchTri(r.agrees_doctrine, f.doctrine) &&
    matchTri(r.available, f.availability) &&
    (!f.group || r.chosen_group === f.group) &&
    (!q || r.member_name.toLowerCase().includes(q)),
  )
}

export function summarizeSelection(rows: SelectionRow[]): Record<SelectionStatus | 'invitados', number> {
  const out = { pendiente: 0, aprobado: 0, lista_espera: 0, rechazado: 0, invitados: 0 }
  for (const r of rows) {
    out[r.status]++
    if (r.invited_at) out.invitados++
  }
  return out
}

/** Grupos elegidos presentes en las respuestas (para el filtro), sin repetir. */
export function chosenGroupOptions(rows: SelectionRow[]): string[] {
  return [...new Set(rows.map(r => r.chosen_group).filter((g): g is string => !!g))].sort()
}

// ── Invitación ──────────────────────────────────────────────────────────────

/** Solo se invita a un aprobado, con miembro identificado y sin invitación previa.
 *  (El correo de invitación va al miembro, así que una respuesta de invitado sin
 *  member_id no se puede invitar desde acá.) */
export function canInvite(row: Pick<SelectionRow, 'status' | 'invited_at' | 'member_id'>): boolean {
  return row.status === 'aprobado' && !row.invited_at && !!row.member_id
}

export function inviteCandidates(rows: SelectionRow[]): SelectionRow[] {
  return rows.filter(canInvite)
}

/** Motivo por el que NO se puede invitar (para el mensaje del API). */
export function inviteBlockReason(row: Pick<SelectionRow, 'status' | 'invited_at' | 'member_id'>): string | null {
  if (row.invited_at) return 'Ya se le envió la invitación.'
  if (row.status !== 'aprobado') return 'Solo se invita a quienes están aprobados.'
  if (!row.member_id) return 'La respuesta no está ligada a un miembro del sistema.'
  return null
}
