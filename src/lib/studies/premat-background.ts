// PRE-9: antecedentes de la pareja + diagnóstico del wizard prematrimonial
// (catálogos con los TEXTOS EXACTOS de la spec + validación pura, compartida
// por el wizard y el POST).

export const DATING_TIME_QUESTION = '¿Cuánto tiempo tienen de estar de novios?'
export const DATING_TIME_OPTIONS = [
  { value: 'menos_1', label: 'Menos de 1 año' },
  { value: '1_2', label: '1 a 2 años' },
  { value: '3_4', label: '3 a 4 años' },
  { value: 'mas_4', label: 'Más de 4 años' },
] as const

export const FIRST_MARRIAGE_QUESTION = '¿Es el primer matrimonio para ambos?'
export const PREVIOUS_MARRIAGE_LABEL = 'Por favor indicar brevemente la situación previo a este proceso.'
export const CHILDREN_QUESTION = '¿Tienen hijos de relaciones anteriores o en común?'
export const CHILDREN_AGES_LABEL = 'Indicá las edades'
export const LIVING_QUESTION = '¿Actualmente viven en casas separadas o ya conviven juntos?'
export const LIVING_OPTIONS = [
  { value: 'separadas', label: 'Casas separadas' },
  { value: 'convivimos', label: 'Ya convivimos' },
] as const

export const CEREMONY_DATE_QUESTION =
  '¿Tienen fecha definida o aproximada para la boda? (Si ya la tienen, indicá la fecha. Recordá que el curso debe iniciar mínimo 6 meses antes).'

export const DIAGNOSTIC_QUESTION =
  '¿Existe alguna situación particular o conversación difícil que hayan estado evitando o que quisieran abordar con el apoyo de sus futuros dirigentes?'

export type PrematBackground = {
  dating_time: string | null
  first_marriage: boolean | null
  previous_marriage_notes: string | null
  has_children: boolean | null
  children_ages: string | null
  living_arrangement: string | null
  diagnostic_notes: string | null
}

/** Normaliza y valida los antecedentes. Devuelve el objeto saneado o un error
 *  humano. Todas las preguntas cerradas son OBLIGATORIAS; los condicionales
 *  (detalle de matrimonio previo, edades de hijos) se exigen según la respuesta. */
export function parsePrematBackground(raw: unknown): { ok: true; value: PrematBackground } | { ok: false; error: string } {
  const b = (raw ?? {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

  const datingTime = str(b.dating_time)
  if (!DATING_TIME_OPTIONS.some(o => o.value === datingTime)) {
    return { ok: false, error: 'Indicá cuánto tiempo tienen de estar de novios.' }
  }
  if (typeof b.first_marriage !== 'boolean') {
    return { ok: false, error: 'Indicá si es el primer matrimonio para ambos.' }
  }
  const prevNotes = str(b.previous_marriage_notes)
  if (b.first_marriage === false && !prevNotes) {
    return { ok: false, error: 'Indicá brevemente la situación previa a este proceso.' }
  }
  if (typeof b.has_children !== 'boolean') {
    return { ok: false, error: 'Indicá si tienen hijos.' }
  }
  const ages = str(b.children_ages)
  if (b.has_children === true && !ages) {
    return { ok: false, error: 'Indicá las edades de los hijos.' }
  }
  const living = str(b.living_arrangement)
  if (!LIVING_OPTIONS.some(o => o.value === living)) {
    return { ok: false, error: 'Indicá si viven en casas separadas o ya conviven.' }
  }

  return {
    ok: true,
    value: {
      dating_time: datingTime,
      first_marriage: b.first_marriage,
      // El detalle solo se guarda si aplica (no arrastra texto de un cambio de respuesta).
      previous_marriage_notes: b.first_marriage === false ? (prevNotes || null) : null,
      has_children: b.has_children,
      children_ages: b.has_children === true ? (ages || null) : null,
      living_arrangement: living,
      diagnostic_notes: str(b.diagnostic_notes) || null,
    },
  }
}

/** Campos PASTORALES de la solicitud: se recortan para roles que no son
 *  coordinador_estudios/direccion/admin (mismo criterio que PRE-8). */
export const SENSITIVE_BACKGROUND_FIELDS = ['previous_marriage_notes', 'diagnostic_notes'] as const

export function redactSensitiveBackground<T extends Record<string, unknown>>(row: T): T {
  const copy = { ...row }
  for (const f of SENSITIVE_BACKGROUND_FIELDS) {
    if (f in copy) (copy as Record<string, unknown>)[f] = null
  }
  return copy
}
