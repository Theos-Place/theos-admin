// Elegibilidad de matrícula sobre datos reales (planes + grupos de dominio).
// Versión server-side de la lógica que antes vivía en enrollment-eligibility.ts (mock).

import type { StudyType, StudyGroup } from '@/types/study'

export type EligibilityResult = {
  study_code: string
  study_name: string
  stage: string
  weeks: number
  is_eligible: boolean
  /** El estudio es invitation_only y el miembro tiene invitación activa. */
  by_invitation: boolean
  /** El miembro tiene una excepción de matrícula activa para este plan. */
  by_exception: boolean
  reasons_blocked: string[]
  reasons_met: string[]
  available_groups: EligibleGroup[]
}

export type EligibleGroup = {
  group_id: string
  zone: string
  schedule_days: string
  schedule_time: string
  leader_name: string
  spots_available: number
  max_capacity: number
  filled: number
  start_date: string
  requires_payment: boolean
  cost: number | null
}

export type MemberStudyProfile = {
  completed_codes: string[]
  current_code: string | null
  is_donor: boolean
  is_server: boolean
  /** Check-ins de charla en los últimos 6 meses (ventana de matrícula). */
  charla_count: number
  /** Códigos de planes invitation_only con invitación ACTIVA para este miembro. */
  invited_codes?: string[]
  /** Excepciones de matrícula activas: code → requisitos perdonados
   *  ('donor'|'attendance'|'server'|'prerequisite'|'age' o 'all'). */
  exceptions?: Record<string, string[]>
  /** Edad del miembro (para filtrar grupos con rango de edad). null = sin fecha. */
  member_age?: number | null
}

/** Asistencia mínima para MATRICULAR: 12 charlas en los últimos 6 meses.
 *  Deliberadamente más estricto y separado del criterio general del sistema
 *  (cobertura mensual) — decisión de producto 2026-06-11. */
export const MATRICULA_MIN_CHARLAS = 12

const DAY_LABELS: Record<string, string> = {
  L: 'Lunes', M: 'Martes', X: 'Miércoles',
  J: 'Jueves', V: 'Viernes', S: 'Sábado', D: 'Domingo',
}

function formatDays(days: string[]): string {
  const labels = (days ?? []).map(d => DAY_LABELS[d] ?? d)
  if (labels.length === 0) return ''
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} y ${labels[1]}`
  return labels.slice(0, -1).join(', ') + ' y ' + labels[labels.length - 1]
}

/** ¿Completó algún estudio que tenga a `code` como prerequisito (directo o
 *  transitivo)? Si llevó algo posterior de la cadena, ya pasó por `code`. */
function completedDescendant(code: string, plans: StudyType[], completedCodes: string[]): boolean {
  const completed = new Set(completedCodes)
  const stack = [code]
  const seen = new Set<string>()
  while (stack.length > 0) {
    const current = stack.pop()!
    for (const p of plans) {
      if (p.prerequisite !== current || seen.has(p.code)) continue
      if (completed.has(p.code)) return true
      seen.add(p.code)
      stack.push(p.code)
    }
  }
  return false
}

export function computeEligibility(
  plans: StudyType[],
  groups: StudyGroup[],
  profile: MemberStudyProfile,
): EligibilityResult[] {
  const invitedCodes = new Set(profile.invited_codes ?? [])
  return plans
    // Invitation_only: ocultos por completo salvo invitación activa (A7).
    .filter(study => !study.requires_invitation || invitedCodes.has(study.code))
    .map(study => {
    const reasons_blocked: string[] = []
    const reasons_met: string[] = []
    const by_invitation = !!study.requires_invitation && invitedCodes.has(study.code)
    if (by_invitation) reasons_met.push('Estás invitado a este estudio ✓')

    // Excepción de matrícula activa: requisitos perdonados para este plan.
    const waived = profile.exceptions?.[study.code]
    const by_exception = !!waived && waived.length > 0
    const isWaived = (req: string) => !!waived && (waived.includes('all') || waived.includes(req))

    // 1. Prerequisito
    if (study.prerequisite) {
      const prereqName = plans.find(s => s.code === study.prerequisite)?.name ?? study.prerequisite
      if (profile.completed_codes.includes(study.prerequisite)) {
        reasons_met.push(`Completaste ${prereqName}`)
      } else if (isWaived('prerequisite')) {
        reasons_met.push(`Prerequisito (${prereqName}) eximido por excepción ✓`)
      } else {
        reasons_blocked.push(`Necesitás completar ${prereqName} primero`)
      }
    } else {
      reasons_met.push('No requiere estudios previos')
    }

    // 2. No está cursándolo
    if (profile.current_code === study.code) {
      reasons_blocked.push('Ya estás matriculado en este estudio')
    }

    // 3. No lo completó
    if (profile.completed_codes.includes(study.code)) {
      reasons_blocked.push('Ya completaste este estudio')
    }

    // 3b. No completó un estudio POSTERIOR de la cadena (si llevó Panorama,
    // ya pasó por los Discípulos aunque no estén registrados).
    if (completedDescendant(study.code, plans, profile.completed_codes)) {
      reasons_blocked.push('Ya completaste un estudio más avanzado de esta cadena')
    }

    // 4. Compromisos (cada uno puede eximirse por excepción)
    if (study.req_donor) {
      if (profile.is_donor) reasons_met.push('Sos donador activo ✓')
      else if (isWaived('donor')) reasons_met.push('Requisito de donador eximido por excepción ✓')
      else reasons_blocked.push('Requiere ser donador activo de Theos')
    }
    if (study.req_server) {
      if (profile.is_server) reasons_met.push('Servís activamente en un comité ✓')
      else if (isWaived('server')) reasons_met.push('Requisito de servidor eximido por excepción ✓')
      else reasons_blocked.push('Requiere servir activamente en un comité')
    }
    if (study.req_attendee) {
      if (profile.charla_count >= MATRICULA_MIN_CHARLAS) reasons_met.push('Asistís regularmente a las charlas ✓')
      else if (isWaived('attendance')) reasons_met.push('Requisito de asistencia eximido por excepción ✓')
      else reasons_blocked.push(`Requiere asistencia regular: al menos ${MATRICULA_MIN_CHARLAS} charlas con check-in en los últimos 6 meses (llevás ${profile.charla_count})`)
    }

    const is_eligible = reasons_blocked.length === 0

    const available_groups: EligibleGroup[] = is_eligible
      ? groups
          .filter(g => {
            const active = g.participants.filter(p => p.status !== 'withdrawn').length
            // Rango de edad del grupo: solo se ofrece si la edad del miembro encaja
            // (salvo excepción por edad, o si no tenemos la edad del miembro).
            const ageOk = isWaived('age') || profile.member_age == null
              || ((g.age_min == null || profile.member_age >= g.age_min)
                && (g.age_max == null || profile.member_age <= g.age_max))
            return g.study_type_id === study.code && g.status === 'en_matricula' && active < g.max_capacity && ageOk
          })
          .map(g => {
            const active = g.participants.filter(p => p.status !== 'withdrawn').length
            return {
              group_id: g.id,
              zone: g.zone,
              schedule_days: formatDays(g.schedule_days),
              schedule_time: g.schedule_time,
              leader_name: g.leader_name ?? 'Sin asignar',
              spots_available: g.max_capacity - active,
              max_capacity: g.max_capacity,
              filled: active,
              start_date: g.start_date,
              requires_payment: study.requires_payment,
              cost: study.cost ?? null,
            }
          })
      : []

    return {
      study_code: study.code,
      study_name: study.name,
      stage: study.stage,
      weeks: study.weeks,
      is_eligible,
      by_invitation,
      by_exception,
      reasons_blocked,
      reasons_met,
      available_groups,
    }
  })
}

// ── Solicitudes de estudios ───────────────────────────────────────────────────

/** Estudios elegibles como DESTINO de una reubicación (niveles + cadena DIS + SCJ).
 *  El resto de capacitaciones no admite reubicación. */
export const RELOCATION_ELIGIBLE_CODES = ['N1', 'N2', 'N3', 'N4', 'DIS1', 'DIS2', 'DIS3', 'SCJ'] as const

export function isRelocationEligibleCode(code: string | null | undefined): boolean {
  return Boolean(code && (RELOCATION_ELIGIBLE_CODES as readonly string[]).includes(code))
}
