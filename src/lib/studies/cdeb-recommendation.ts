// EST-9: recomendación a CDEB (Cómo Dar Estudios de Biblia) al cerrar grupos
// de Discípulos 3 y Panorama. Catálogos con los TEXTOS EXACTOS de la spec +
// validación pura (la usa el form del cierre y el API).
//
// Principio de diseño: el dirigente llena esto EN EL CELULAR al final de un
// cierre → convicciones por excepción (cero toques si no hay observaciones) y
// escalas como botones en fila.
import type { RoleId } from '@/types/auth'

/** Planes con cierre especial de recomendación a CDEB. */
const CDEB_SOURCE_PLANS = new Set(['DIS3', 'PAN'])

export function allowsCdebRecommendation(planCode: string | null | undefined): boolean {
  return !!planCode && CDEB_SOURCE_PLANS.has(planCode)
}

/** La opción "X — Sin información suficiente" (testimonio y pasión) existe
 *  SOLO en grupos de Panorama: en DIS3 el dirigente ya conoce al estudiante. */
export function allowsNoInfoOption(planCode: string | null | undefined): boolean {
  return planCode === 'PAN'
}

/** Quién ve las recomendaciones. Decisión confirmada: NI el propio miembro, NI
 *  el dirigente que la escribió (una vez enviada), NI dirección. */
export const CDEB_REC_VIEW_ROLES: RoleId[] = ['coordinador_dirigentes', 'coordinador_estudios', 'admin']

export const HEADER_TEXT = [
  'Recomendar a alguien para CDEB es una responsabilidad: esta persona podría enseñar la Biblia a otros.',
  'Te pedimos orar antes de llenar esta evaluación y responder con honestidad.',
  'Recomendar no asegura la invitación al curso: el comité evalúa también otros aspectos.',
] as const

export const COMPLETION_DATE_LABEL = 'Fecha de finalización del estudio'
export const COMPLETION_DATE_HINT = 'Si no lo has terminado, ingresá la fecha prevista'

// ── Convicciones (por excepción) ─────────────────────────────────────────────
export const CONVICTIONS_INSTRUCTION = 'Todos los temas arrancan en "convicción firme". Marcá solo los temas donde viste dudas o postura contraria.'
export const CONVICTION_TOPICS = [
  { value: 'sexualidad', label: 'Sexualidad y relaciones antes del matrimonio' },
  { value: 'mayordomia', label: 'Mayordomía' },
  { value: 'autoridad_biblia', label: 'Autoridad de la Biblia' },
  { value: 'salvacion_gracia', label: 'Salvación por gracia' },
  { value: 'identidad_genero', label: 'Identidad de género' },
] as const

export const CONVICTION_STANCES = [
  { value: 'dudas', label: 'Tiene dudas' },
  { value: 'contraria', label: 'Postura contraria' },
] as const

export type ConvictionFlag = { topic: string; stance: string; notes?: string | null }

// ── Escalas 1-5 ──────────────────────────────────────────────────────────────
/** Etiqueta del nivel, visible al seleccionar (no dropdown). */
export const SCALE_LABELS: Record<string, string> = {
  '1': 'Muy bajo', '2': 'Bajo', '3': 'Regular', '4': 'Bueno', '5': 'Excelente',
  x: 'Sin información suficiente',
}

export const TESTIMONY_LABEL = 'Testimonio'
export const TESTIMONY_TEXT_LABEL = 'Describa brevemente el testimonio del estudiante'
export const PASSION_LABEL = 'Pasión por enseñar / dar a conocer a Jesús'
export const PASSION_TEXT_LABEL = '¿Le ha visto compartir su fe o invitar a alguien por iniciativa propia? Describa un ejemplo'
export const BIBLE_LABEL = 'Conocimiento bíblico'
export const SPEECH_LABEL = 'Expresión verbal'
export const SPEECH_TEXT_LABEL = 'Ejemplo o comentario sobre cómo se expresa'
export const COMMITMENT_TEXT_LABEL = 'Comentario adicional sobre su compromiso'
export const COMMITTEE_TEXT_LABEL = 'Comentarios adicionales para el comité de dirigentes'
/** Los textos libres obligatorios aceptan "NA" cuando no aplica. */
export const NA_HINT = 'Si no aplica, escribí "NA".'

export const RECOMMENDATION_LABEL = 'Recomendación final'
export const RECOMMENDATION_OPTIONS = [
  { value: 'si_sin_reservas', label: 'Sí, sin reservas' },
  { value: 'si_otro_estudio', label: 'Sí, pero debería llevar otro estudio primero' },
  { value: 'si_con_reservas', label: 'Sí, con reservas (ver comentarios)' },
  { value: 'no', label: 'No lo recomiendo' },
] as const

export type CdebRecommendationInput = {
  member_id: string
  completion_date?: string | null
  convictions: ConvictionFlag[]
  testimony_score?: string | null
  testimony_notes?: string | null
  passion_score?: string | null
  passion_notes?: string | null
  bible_knowledge_score?: string | null
  speech_score?: string | null
  speech_notes?: string | null
  commitment_notes?: string | null
  committee_notes?: string | null
  recommendation?: string | null
  /** Con 'si_otro_estudio': code del plan que debería llevar primero. */
  recommended_prior_study?: string | null
}

const SCALES = new Set(['1', '2', '3', '4', '5'])

/**
 * Valida una recomendación para ENVIAR (status 'enviada'). Los borradores no
 * se validan: el cierre nunca se bloquea por un guardado parcial.
 * null = lista para enviar; string = qué falta (mensaje humano).
 */
export function validateCdebRecommendation(
  r: CdebRecommendationInput,
  planCode: string | null | undefined,
): string | null {
  const withNoInfo = allowsNoInfoOption(planCode)
  const scaleOk = (v: string | null | undefined, allowX: boolean) =>
    !!v && (SCALES.has(v) || (allowX && v === 'x'))
  const filled = (v: string | null | undefined) => !!(v ?? '').trim()

  if (!scaleOk(r.testimony_score, withNoInfo)) return `Calificá ${TESTIMONY_LABEL.toLowerCase()}.`
  if (!scaleOk(r.passion_score, withNoInfo)) return 'Calificá la pasión por enseñar.'
  if (!scaleOk(r.bible_knowledge_score, false)) return `Calificá ${BIBLE_LABEL.toLowerCase()}.`
  if (!scaleOk(r.speech_score, false)) return `Calificá ${SPEECH_LABEL.toLowerCase()}.`

  // Textos libres obligatorios (aceptan "NA"); el de compromiso es opcional.
  if (!filled(r.testimony_notes)) return `${TESTIMONY_TEXT_LABEL}. ${NA_HINT}`
  if (!filled(r.passion_notes)) return `${PASSION_TEXT_LABEL}. ${NA_HINT}`
  if (!filled(r.speech_notes)) return `${SPEECH_TEXT_LABEL}.`
  if (!filled(r.committee_notes)) return `${COMMITTEE_TEXT_LABEL}.`

  // Convicciones: cada tema marcado exige su explicación.
  for (const c of r.convictions ?? []) {
    if (!CONVICTION_TOPICS.some(t => t.value === c.topic)) return 'Hay un tema de convicciones fuera del catálogo.'
    if (!CONVICTION_STANCES.some(s => s.value === c.stance)) return 'Hay una postura fuera del catálogo.'
    if (!filled(c.notes)) {
      const label = CONVICTION_TOPICS.find(t => t.value === c.topic)?.label ?? c.topic
      return `Explicá lo que viste en "${label}".`
    }
  }

  if (!RECOMMENDATION_OPTIONS.some(o => o.value === r.recommendation)) return `Elegí la ${RECOMMENDATION_LABEL.toLowerCase()}.`
  if (r.recommendation === 'si_otro_estudio' && !filled(r.recommended_prior_study)) {
    return 'Indicá cuál estudio debería llevar primero.'
  }
  return null
}

/** Sanea lo que se GUARDA (borrador o envío): descarta valores fuera de
 *  catálogo y convicciones sin tema/postura válidos. */
export function sanitizeCdebRecommendation(
  r: CdebRecommendationInput,
  planCode: string | null | undefined,
): CdebRecommendationInput {
  const withNoInfo = allowsNoInfoOption(planCode)
  const scale = (v: string | null | undefined, allowX: boolean) => {
    const s = (v ?? '').trim()
    return SCALES.has(s) || (allowX && s === 'x') ? s : null
  }
  const text = (v: string | null | undefined) => ((v ?? '').trim() || null)
  return {
    member_id: r.member_id,
    completion_date: text(r.completion_date),
    convictions: (r.convictions ?? [])
      .filter(c => CONVICTION_TOPICS.some(t => t.value === c.topic) && CONVICTION_STANCES.some(s => s.value === c.stance))
      .map(c => ({ topic: c.topic, stance: c.stance, notes: text(c.notes) })),
    testimony_score: scale(r.testimony_score, withNoInfo),
    testimony_notes: text(r.testimony_notes),
    passion_score: scale(r.passion_score, withNoInfo),
    passion_notes: text(r.passion_notes),
    bible_knowledge_score: scale(r.bible_knowledge_score, false),
    speech_score: scale(r.speech_score, false),
    speech_notes: text(r.speech_notes),
    commitment_notes: text(r.commitment_notes),
    committee_notes: text(r.committee_notes),
    recommendation: RECOMMENDATION_OPTIONS.some(o => o.value === r.recommendation) ? r.recommendation! : null,
    // El estudio previo solo tiene sentido con 'si_otro_estudio'.
    recommended_prior_study: r.recommendation === 'si_otro_estudio' ? text(r.recommended_prior_study) : null,
  }
}
