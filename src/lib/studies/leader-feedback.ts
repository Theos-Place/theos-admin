// Retroalimentación al dirigente: los estudiantes califican a quien los dirigió
// cuando el grupo cierra. Puro — lo usan el endpoint, la pantalla del estudiante
// y el resumen que ve el dirigente.
//
// ANONIMATO: la respuesta guarda member_id, pero SOLO para que nadie responda
// dos veces. Al dirigente se le muestra el promedio y los comentarios sin
// nombres. Es la única forma de que los comentarios sirvan de algo.
import { EVALUATION_WINDOW_CLOSED_MESSAGE } from './evaluation-window'

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
  /** DIR-5: la ventana de dos semanas ya venció. Las respuestas tardías se
   *  rechazan para que un compilado ya revisado no cambie después. */
  windowClosed?: boolean
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
  // Va de última entre las que dependen de la persona: si igual no le tocaba,
  // "ya cerró" sería una explicación equivocada.
  if (input.windowClosed) {
    return { allowed: false, reason: EVALUATION_WINDOW_CLOSED_MESSAGE }
  }
  return { allowed: true }
}

/** Una respuesta tal como la ve la coordinación (con el estado de moderación). */
export type FeedbackRow = {
  id?: string
  score: number
  comments?: string | null
  /** Ocultado por la coordinación: el dirigente no lo ve. */
  hidden?: boolean
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

/** `forLeader` deja fuera los comentarios ocultados por la coordinación. La
 *  NOTA de esas respuestas SIGUE contando: ocultar un comentario fuera de lugar
 *  no es descartar la opinión de esa persona. */
export function summarize(
  rows: ReadonlyArray<FeedbackRow>,
  opts?: { forLeader?: boolean },
): FeedbackSummary {
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let suma = 0
  const comments: string[] = []
  for (const r of rows) {
    const n = Math.round(r.score)
    if (n >= SCORE_MIN && n <= SCORE_MAX) distribution[n]++
    suma += r.score
    if (opts?.forLeader && r.hidden) continue
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

/** Qué ve el DIRIGENTE. Dos condiciones, en este orden:
 *   1. que la coordinación ya lo haya REVISADO Y COMPARTIDO (decisión
 *      2026-08-06: no se le manda automáticamente — un comentario injusto no
 *      se puede "des-leer");
 *   2. que haya respuestas suficientes para que nadie quede identificado.
 *  Mientras falte cualquiera de las dos, el dirigente no ve ni el promedio. */
export type LeaderView =
  | { state: 'sin_revisar' }
  | { state: 'pocas'; count: number }
  | { state: 'visible'; summary: FeedbackSummary }

export function leaderView(input: {
  released: boolean
  summary: FeedbackSummary
}): LeaderView {
  if (!input.released) return { state: 'sin_revisar' }
  if (input.summary.count < MIN_RESPUESTAS_PARA_MOSTRAR) {
    return { state: 'pocas', count: input.summary.count }
  }
  return { state: 'visible', summary: input.summary }
}
