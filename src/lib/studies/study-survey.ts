// EST-12 · Cómo se puntúa la encuesta de satisfacción del dirigente.
//
// El formulario pregunta con palabras ("Siempre", "A veces"), no con números:
// pedirle a alguien que califique a su dirigente del 1 al 5 da respuestas peores
// que preguntarle con qué frecuencia pasó algo. Pero para promediar y comparar
// entre grupos hace falta un número.
//
// LA REGLA: en cada pregunta la PRIMERA opción es la mejor y la última la peor,
// y el puntaje se reparte parejo entre 5 y 1 según la posición. Así una pregunta
// de 4 opciones y otra de 5 son comparables sin tener que mantener una tabla de
// puntajes por pregunta, que se desincroniza en cuanto alguien edita el
// formulario.
//
// "No aplica" NO puntúa: mezclarlo con "poco sensible" sería inventar una
// opinión que la persona no dio.
import { SCORE_MAX, SCORE_MIN } from '@/lib/studies/leader-feedback'

/** Opciones que significan "esto no me tocó vivirlo": no entran al promedio. */
const NO_APLICA = ['no aplica', 'n/a', 'na']

export function isNoAplica(opcion: string): boolean {
  return NO_APLICA.includes(opcion.trim().toLowerCase())
}

/**
 * Puntaje 1-5 de UNA respuesta, por la posición de la opción elegida.
 * Devuelve null si no puntúa (no aplica, opción desconocida, sin respuesta).
 */
export function scoreFromOptions(options: readonly string[], answer: string | null | undefined): number | null {
  if (!answer) return null
  const elegida = answer.trim()
  if (isNoAplica(elegida)) return null

  // Las opciones que puntúan, en orden: las de "no aplica" salen de la escala
  // para que no corran el reparto.
  const escala = options.filter(o => !isNoAplica(o))
  const i = escala.findIndex(o => o.trim().toLowerCase() === elegida.toLowerCase())
  if (i === -1) return null
  if (escala.length === 1) return SCORE_MAX

  // Primera = 5, última = 1, el resto repartido parejo.
  const paso = (SCORE_MAX - SCORE_MIN) / (escala.length - 1)
  return Math.round((SCORE_MAX - i * paso) * 100) / 100
}

export type RespuestaCerrada = {
  fieldId: string
  label: string
  options: readonly string[]
  answer: string | null
}

/** Promedio de una respuesta completa (todas sus preguntas cerradas).
 *  null si no puntuó ninguna — p. ej. todo "No aplica". */
export function responseAverage(preguntas: readonly RespuestaCerrada[]): number | null {
  const notas = preguntas
    .map(p => scoreFromOptions(p.options, p.answer))
    .filter((n): n is number => n !== null)
  if (notas.length === 0) return null
  const prom = notas.reduce((a, b) => a + b, 0) / notas.length
  return Math.round(prom * 100) / 100
}

export type PreguntaResumen = {
  fieldId: string
  label: string
  /** Promedio de esta pregunta, 1-5. null = nadie la puntuó. */
  average: number | null
  /** Cuántas respuestas puntuaron (sin contar "No aplica"). */
  count: number
  /** Cuántas veces se eligió cada opción, en el orden del formulario. */
  breakdown: Record<string, number>
}

/** Promedio POR PREGUNTA sobre varias respuestas. Es lo que hace útil el panel:
 *  un promedio general de 4.2 no dice en qué hay que mejorar; ver que la
 *  pregunta de "fomentó la participación" está en 3.1 sí. */
export function perQuestionSummary(
  respuestas: ReadonlyArray<readonly RespuestaCerrada[]>,
): PreguntaResumen[] {
  const porPregunta = new Map<string, PreguntaResumen & { suma: number }>()
  for (const respuesta of respuestas) {
    for (const p of respuesta) {
      let acc = porPregunta.get(p.fieldId)
      if (!acc) {
        acc = { fieldId: p.fieldId, label: p.label, average: null, count: 0, breakdown: {}, suma: 0 }
        for (const o of p.options) acc.breakdown[o] = 0
        porPregunta.set(p.fieldId, acc)
      }
      if (p.answer) acc.breakdown[p.answer] = (acc.breakdown[p.answer] ?? 0) + 1
      const n = scoreFromOptions(p.options, p.answer)
      if (n !== null) { acc.suma += n; acc.count++ }
    }
  }
  return [...porPregunta.values()].map(({ suma, ...r }) => ({
    ...r,
    average: r.count ? Math.round((suma / r.count) * 100) / 100 : null,
  }))
}

/** Momento del envío: el cierre más el desfase. Por defecto el día siguiente —
 *  mandarla en el mismo minuto en que el dirigente cierra el grupo se siente
 *  automático y se responde peor. */
export function surveySendAt(closedAtIso: string, offsetHours = 24): string | null {
  const t = new Date(closedAtIso)
  if (Number.isNaN(t.getTime())) return null
  return new Date(t.getTime() + offsetHours * 3_600_000).toISOString()
}

/** ¿A este grupo le toca ya la encuesta? Condición exacta del cron. */
export function isSurveyDue(g: {
  survey_enabled: boolean
  survey_send_at: string | null
  feedback_requested_at: string | null
  status: string | null
}, now: Date): boolean {
  if (!g.survey_enabled) return false
  if (g.feedback_requested_at) return false          // dedupe
  if (g.status !== 'finalizado') return false
  if (!g.survey_send_at) return false
  const t = new Date(g.survey_send_at)
  return !Number.isNaN(t.getTime()) && t.getTime() <= now.getTime()
}
