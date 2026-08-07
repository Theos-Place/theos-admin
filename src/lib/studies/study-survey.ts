// EST-12 · Cómo se puntúa la encuesta de satisfacción del dirigente.
//
// El formulario admite DOS formas de preguntar y las dos puntúan igual:
//
//  · CALIFICACIÓN 1-5 (hoy) — una fila de botones con las puntas etiquetadas.
//    Es lo que se usa desde 2026-08-07: con palabras distintas en cada pregunta
//    la encuesta se hacía larga de leer y la gente la abandonaba.
//  · PALABRAS ("Siempre", "A veces") — como nació. Se mantiene porque las
//    respuestas ya guardadas se siguen leyendo así, y porque una pregunta
//    puntual puede necesitar sus propias opciones.
//
// LA REGLA en palabras: la PRIMERA opción es la mejor y la última la peor, con
// el puntaje repartido parejo entre 5 y 1 según la posición. Así una pregunta de
// 4 opciones y otra de 5 son comparables sin mantener una tabla de puntajes por
// pregunta, que se desincroniza en cuanto alguien edita el formulario.
//
// LA REGLA en calificación: 5 es lo mejor y 1 lo peor, normalizado por si
// alguien cambia la escala a 1-10.
//
// Lo que NO puntúa: "No aplica" en las de palabras, y la pregunta en blanco en
// las de calificación (es su equivalente: no la respondió). Contarlo como un 1
// sería inventar una opinión que la persona no dio.
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
  /** 'scale' = el formulario pregunta con una calificación 1-5 en vez de
   *  palabras. Ausente = radio, que es como nació el formulario. */
  kind?: 'radio' | 'scale'
  scaleMin?: number | null
  scaleMax?: number | null
}

/**
 * Puntaje 1-5 de una calificación numérica.
 *
 * Se normaliza al rango 1-5 por si alguien edita la escala del formulario a
 * 1-10: la nota tiene que seguir siendo comparable con la de los grupos que
 * respondieron antes. Sin respuesta → null (así "no aplica" se expresa dejando
 * la pregunta en blanco, que es lo que reemplaza a la opción "No aplica").
 */
export function scoreFromScale(
  answer: string | number | null | undefined, min = 1, max = 5,
): number | null {
  if (answer === null || answer === undefined || answer === '') return null
  const n = typeof answer === 'number' ? answer : Number(String(answer).trim())
  if (!Number.isFinite(n)) return null
  const lo = Number.isFinite(min) ? min : 1
  const hi = Number.isFinite(max) ? max : 5
  if (hi <= lo) return null
  const acotado = Math.min(hi, Math.max(lo, n))
  const norm = SCORE_MIN + ((acotado - lo) / (hi - lo)) * (SCORE_MAX - SCORE_MIN)
  return Math.round(norm * 100) / 100
}

/** El puntaje de una respuesta, sea escala o palabras. Es el único lugar que
 *  decide cómo se lee cada tipo. */
export function scoreOf(p: RespuestaCerrada): number | null {
  return p.kind === 'scale'
    ? scoreFromScale(p.answer, p.scaleMin ?? 1, p.scaleMax ?? 5)
    : scoreFromOptions(p.options, p.answer)
}

/** Las "opciones" de una pregunta para el conteo y las tablas.
 *  En una escala son los números en orden ascendente (1, 2, 3, 4, 5).
 *
 *  OJO, no es una preferencia: JavaScript ordena las claves ENTERAS de un
 *  objeto de menor a mayor sin importar en qué orden se insertaron, así que el
 *  breakdown de una escala SIEMPRE sale ascendente. Devolverlo al revés acá
 *  daría una cabecera que no coincide con los conteos. La leyenda del correo es
 *  la que aclara qué punta es la buena. */
export function escalaDe(p: RespuestaCerrada): string[] {
  if (p.kind !== 'scale') return p.options.map(String)
  const lo = p.scaleMin ?? 1
  const hi = p.scaleMax ?? 5
  if (hi <= lo) return []
  return Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i))
}

/** Los tipos de campo que PUNTÚAN. Fuente única: si mañana se agrega otro,
 *  se agrega acá y lo toman el guardado, el panel y el correo por igual. */
export const CLOSED_FIELD_TYPES = ['radio', 'scale'] as const

export type CampoCerrado = {
  id: string
  label: string
  field_type: string
  options?: unknown
  scale_min?: number | null
  scale_max?: number | null
}

/** Arma la respuesta puntuable de un campo. null si el campo no puntúa.
 *  Un solo lugar decide cómo se lee cada tipo — antes el criterio estaba
 *  repetido en tres consultas y se desincronizaba al agregar un tipo. */
export function toRespuestaCerrada(
  field: CampoCerrado, answer: string | number | null | undefined,
): RespuestaCerrada | null {
  if (!(CLOSED_FIELD_TYPES as readonly string[]).includes(field.field_type)) return null
  return {
    fieldId: field.id,
    label: field.label,
    options: Array.isArray(field.options) ? (field.options as string[]) : [],
    answer: answer === null || answer === undefined ? null : String(answer),
    kind: field.field_type === 'scale' ? 'scale' : 'radio',
    scaleMin: field.scale_min ?? 1,
    scaleMax: field.scale_max ?? 5,
  }
}

/** Promedio de una respuesta completa (todas sus preguntas cerradas).
 *  null si no puntuó ninguna — p. ej. todo "No aplica". */
export function responseAverage(preguntas: readonly RespuestaCerrada[]): number | null {
  const notas = preguntas
    .map(scoreOf)
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
        for (const o of escalaDe(p)) acc.breakdown[o] = 0
        porPregunta.set(p.fieldId, acc)
      }
      // Solo se cuenta lo que pertenece a la escala VIGENTE. Una respuesta
      // guardada con el formato anterior (palabras en una pregunta que hoy es
      // calificación) no suma ni inventa una columna nueva en la tabla; queda
      // fuera, igual que ya quedaba fuera del promedio.
      const clave = p.answer === null || p.answer === undefined ? '' : String(p.answer)
      if (clave !== '' && clave in acc.breakdown) {
        acc.breakdown[clave] = (acc.breakdown[clave] ?? 0) + 1
      }
      const n = scoreOf(p)
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
