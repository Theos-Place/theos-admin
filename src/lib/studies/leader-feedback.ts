// Retroalimentación al dirigente: los estudiantes califican a quien los dirigió
// cuando el grupo cierra. Puro — lo usan el endpoint, la pantalla del estudiante
// y el resumen que ve el dirigente.
//
// ANONIMATO: la respuesta guarda member_id, pero SOLO para que nadie responda
// dos veces. Al dirigente se le muestra el promedio y los comentarios sin
// nombres. Es la única forma de que los comentarios sirvan de algo.

export const SCORE_MIN = 1
export const SCORE_MAX = 5

/** Etiquetas de la escala. Números pelados no significan lo mismo para todos. */
export const SCORE_LABELS: Record<number, string> = {
  1: 'Muy por debajo de lo que esperaba',
  2: 'Por debajo de lo que esperaba',
  3: 'Cumplió',
  4: 'Muy bueno',
  5: 'Excelente',
}

export const COMMENT_MAX = 1000

export type FeedbackInput = { score: number; comments?: string | null }

/** Motivo por el que la respuesta no es válida, o null. */
export function feedbackError(input: FeedbackInput): string | null {
  if (!Number.isInteger(input.score)) return 'Elegí una nota del 1 al 5.'
  if (input.score < SCORE_MIN || input.score > SCORE_MAX) return 'La nota va del 1 al 5.'
  if ((input.comments ?? '').length > COMMENT_MAX) {
    return `El comentario no puede pasar de ${COMMENT_MAX} caracteres.`
  }
  return null
}

/** Estados de la matrícula que dan derecho a evaluar: quien pasó por el grupo.
 *  Un retiro temprano no evalúa — no vio el estudio. */
export const CAN_EVALUATE_STATUSES = ['completed', 'enrolled'] as const

export function canEvaluate(input: {
  /** Estado de la matrícula de esta persona en el grupo. */
  enrollmentStatus: string | null
  /** El grupo ya cerró. Antes del cierre no se evalúa. */
  groupClosed: boolean
  /** Ya respondió. */
  alreadyAnswered: boolean
  /** Es el propio dirigente o co-dirigente del grupo. */
  isLeader: boolean
}): { allowed: true } | { allowed: false; reason: string } {
  if (input.isLeader) {
    return { allowed: false, reason: 'No podés evaluarte a vos mismo.' }
  }
  if (!input.groupClosed) {
    return { allowed: false, reason: 'La evaluación se abre cuando el grupo cierra.' }
  }
  if (!input.enrollmentStatus || !(CAN_EVALUATE_STATUSES as readonly string[]).includes(input.enrollmentStatus)) {
    return { allowed: false, reason: 'Esta evaluación es para quienes llevaron el estudio en este grupo.' }
  }
  if (input.alreadyAnswered) {
    return { allowed: false, reason: 'Ya enviaste tu evaluación de este grupo. ¡Gracias!' }
  }
  return { allowed: true }
}

export type FeedbackSummary = {
  count: number
  /** Promedio con un decimal, o null si no hay respuestas. */
  average: number | null
  /** Cuántas respuestas por nota (1..5). */
  distribution: Record<number, number>
  /** Comentarios, SIN quién los escribió. */
  comments: string[]
}

export function summarize(
  rows: ReadonlyArray<{ score: number; comments?: string | null }>,
): FeedbackSummary {
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let suma = 0
  const comments: string[] = []
  for (const r of rows) {
    const n = Math.round(r.score)
    if (n >= SCORE_MIN && n <= SCORE_MAX) distribution[n]++
    suma += r.score
    const c = (r.comments ?? '').trim()
    if (c) comments.push(c)
  }
  return {
    count: rows.length,
    average: rows.length ? Math.round((suma / rows.length) * 10) / 10 : null,
    distribution,
    comments,
  }
}

/** ¿Se le puede mostrar el detalle al dirigente sin delatar a nadie?
 *  Con una o dos respuestas, un comentario identifica al autor casi seguro. */
export const MIN_RESPUESTAS_PARA_MOSTRAR = 3

export function visibleForLeader(s: FeedbackSummary): FeedbackSummary | { count: number; pending: true } {
  if (s.count < MIN_RESPUESTAS_PARA_MOSTRAR) return { count: s.count, pending: true }
  return s
}
