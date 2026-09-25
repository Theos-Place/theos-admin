/**
 * `in_progress` es la persona como ESTUDIANTE (matrícula vigente en un grupo
 * que arrancó) y `leading` como DIRIGENTE (dirige o co-dirige el grupo). Son
 * dos poblaciones casi disjuntas: al 2026-09-23, 431 y 114, con solo 4 en
 * ambas. Pedido de Floriana: hasta ahora el filtro solo sabía de la primera y
 * los dirigentes quedaban fuera sin que la etiqueta lo dijera.
 */
export type StudyStatus =
  | 'completed'
  /** Cursando: matrícula vigente en un grupo que YA arrancó. */
  | 'in_progress'
  /** PAR-5b · En matrícula: inscrita en un grupo que todavía NO arranca. */
  | 'enrolling'
  /** Dando: dirige o co-dirige el grupo. */
  | 'leading'
  | 'any'
  | 'not_taken'
export type TicketStatus = 'pending' | 'paid' | 'exempted' | 'expired' | 'any'
export type AttendanceType = 'participant' | 'server' | 'any'
export type ServiceStatus = 'active' | 'historical' | 'any'
export type FormResponseStatus = 'filled' | 'not_filled' | 'any'
export type QtyOperator = 'gte' | 'lte' | 'eq' | 'any'

/**
 * PAR-5b · NEGAR cualquier condición.
 *
 * `negate` vale para TODAS y no solo para asistencia e inscripción, que eran
 * las dos que lo tenían. Está acá arriba, intersecado con la unión, en vez de
 * repetido en cada miembro: así una condición nueva lo hereda sola y no hay
 * forma de agregar una que no se pueda negar.
 *
 * Se resuelve en UN punto —`resolveAdvancedConditions` intercambia `include` y
 * `exclude` al cerrar la condición—, así que ningún `case` tiene que saber de
 * esto. Vale porque cada `case` aporta EXACTAMENTE UN set: con dos, negar sería
 * ¬(A∧B) = ¬A ∨ ¬B y el intercambio daría ¬A ∧ ¬B, que es otra cosa.
 *
 * Opcional para no romper las listas guardadas: `member_lists` persiste el
 * `FilterState` como JSON y las viejas no lo traen (FIL-1).
 */
export type NegableCondition = { negate?: boolean }

export type FilterCondition = NegableCondition & (
  | { id: number; group: 'study'; type: 'study'; study: string; status: StudyStatus; from: string | null; to: string | null }
  // eventId/eventName son opcionales para no romper listas guardadas (FIL-1).
  | { id: number; group: 'attend'; type: 'attendance'; eventType: string; eventTypeName?: string; sedes: string[]; camp: string; attendanceType: AttendanceType; qtyOp: QtyOperator; qty: string; from: string; to: string; eventId?: string; eventName?: string }
  // FIL-2: inscripción a eventos (event_registrations), con estado del tiquete.
  // El rango de fechas es del EVENTO.
  | { id: number; group: 'attend'; type: 'registration'; eventId: string; eventName?: string; eventType: string; eventTypeName?: string; ticketStatus: TicketStatus; from: string; to: string }
  | { id: number; group: 'service'; type: 'service'; area: string; committee: string; position: string; status: ServiceStatus; from: string; to: string }
  | { id: number; group: 'form'; type: 'form'; formId: string; formName: string; status: FormResponseStatus; from: string; to: string; field: string; fieldVal: string }
  | { id: number; group: 'donor'; type: 'donor'; value: 'yes' | 'no' }
  | { id: number; group: 'age'; type: 'age'; min: string; max: string }
  | { id: number; group: 'status'; type: 'status'; value: 'active' | 'inactive' }
  | { id: number; group: 'leader'; type: 'leader'; value: 'yes' | 'no' }
  // Sirve o no sirve, sin importar dónde. El chip rápido "Servidores" solo sabe
  // afirmar; esto además permite negarlo (quién NO está sirviendo hoy).
  | { id: number; group: 'server'; type: 'server'; value: 'yes' | 'no' }
  | { id: number; group: 'marital'; type: 'marital'; value: string }
  | { id: number; group: 'account'; type: 'account'; value: 'none' | 'never_entered' | 'active' }
  | { id: number; group: 'created'; type: 'created'; from: string; to: string }
)

export interface ConditionGroup {
  id: number
  members: number[]
  op: 'AND' | 'OR'
}

export interface FilterState {
  conditions: FilterCondition[]
  groups: ConditionGroup[]
  /**
   * Operadores AND/OR de nivel superior por unidad. Sin ellos la combinación
   * cambia (todo se une con AND).
   */
  topLevelOps?: Record<string, 'AND' | 'OR'>
  /**
   * Lo que la pantalla de miembros manda FUERA de `conditions` y que durante
   * mucho tiempo no se guardaba con la lista: los chips rápidos, la búsqueda de
   * texto y el filtro de asistencia.
   *
   * Omitirlos no es un detalle. "Invitación N1" se guardó con 260 personas y,
   * recalculada sin `active_attendance`, da 14.848: la condición es "no ha
   * llevado Nivel 1" y el chip de asistencia activa era lo único que la
   * acotaba. Una lista a la que le falta parte de su filtro no se puede
   * recalcular — se ensancharía sola.
   */
  is_donor?: boolean
  is_server?: boolean
  search?: string
  active_attendance?: boolean | 'estudios'
  /**
   * Versión del filtro guardado.
   *
   * Ausente = la lista se guardó cuando solo se persistían `conditions` y
   * `groups`, así que NO se sabe si los otros filtros estaban apagados o
   * simplemente no se guardaron. Esas listas no se recalculan: hay que volver a
   * guardarlas desde la pantalla de miembros. `2` = el filtro está completo.
   */
  v?: 2
}

// Distributive Omit — removes 'id' from each union member individually
type NoId<T> = T extends { id: number } ? Omit<T, 'id'> : T
export type AddableCondition = NoId<FilterCondition>
