// Elegibilidad de matrícula sobre datos reales (planes + grupos de dominio).
// Versión server-side de la lógica que antes vivía en enrollment-eligibility.ts (mock).

import type { StudyType, StudyGroup } from '@/types/study'
import { ATTENDANCE_MONTHS, ATTENDANCE_MIN_CHARLAS, ATTENDANCE_MIN_CHARLAS_INTERMEDIA, ATTENDANCE_RECENCY_DAYS } from '@/lib/attendance'

/** Mapa nivel de BD → etapa de dominio. Fuente ÚNICA (QA 2026-07-17: estaba
 *  triplicado en adapter.ts, studies-demand.ts y studies-eligibility.ts). */
export const LEVEL_TO_STAGE: Record<string, StudyType['stage']> = {
  niveles: 'niveles',
  etapa_inicial: 'inicial',
  etapa_intermedia: 'intermedia',
  campanas: 'campaña',
}

/** Compromisos MÍNIMOS por etapa — fuente ÚNICA para elegibilidad de
 *  solicitudes (meetsStage) y análisis de demanda (QA 2026-07-17: había tres
 *  copias con una discrepancia real en 'niveles': la demanda exigía asistencia
 *  y la elegibilidad no exigía nada).
 *  attendance: 'none' | 'general' (≥6 charlas) | 'intermedia' (≥12, reforzado). */
export type StageRequirements = {
  donor: boolean
  server: boolean
  attendance: 'none' | 'general' | 'intermedia'
}

export function requirementsForStage(stage: string): StageRequirements {
  if (stage === 'inicial') return { donor: false, server: false, attendance: 'general' }
  if (stage === 'intermedia') return { donor: true, server: true, attendance: 'intermedia' }
  return { donor: false, server: false, attendance: 'none' } // niveles y campañas: sin compromisos
}

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
  is_virtual: boolean
}

export type MemberStudyProfile = {
  completed_codes: string[]
  current_code: string | null
  /** Todos los códigos con matrícula 'enrolled' (PRE-5: requisito prematrimonial). */
  enrolled_codes?: string[]
  /** Códigos con matrícula automática pendiente de pago: bloquean la
   *  re-matrícula (el camino es subir el comprobante, no re-inscribirse). */
  pending_payment_codes?: string[]
  is_donor: boolean
  is_server: boolean
  /** Check-ins de charla en los últimos ATTENDANCE_MONTHS meses (solo informativo). */
  charla_count: number
  /** Criterio único de asistencia activa (ver @/lib/attendance): ≥ATTENDANCE_MIN_CHARLAS
   *  charlas en ATTENDANCE_MONTHS meses, con al menos una en ATTENDANCE_RECENCY_DAYS días. */
  attendance_active: boolean
  /** Criterio REFORZADO, exclusivo de Etapa Intermedia (ver
   *  ATTENDANCE_MIN_CHARLAS_INTERMEDIA): el doble de asistencias, misma ventana
   *  y misma condición de recencia. El resto de etapas usa `attendance_active`. */
  attendance_active_intermedia?: boolean
  /** Códigos de planes invitation_only con invitación ACTIVA para este miembro. */
  invited_codes?: string[]
  /** Excepciones de matrícula activas: code → requisitos perdonados
   *  ('donor'|'attendance'|'server'|'prerequisite'|'age' o 'all'). */
  exceptions?: Record<string, string[]>
  /** Edad del miembro (para filtrar grupos con rango de edad). null = sin fecha. */
  member_age?: number | null
  /** Autorización administrativa para ver/matricularse en grupos virtuales
   *  (member_admin_data.authorized_virtual_studies). Por defecto false. */
  authorized_virtual_studies?: boolean
}

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

    // 2. No está cursándolo ni tiene la matrícula pendiente de pago
    if (profile.current_code === study.code) {
      reasons_blocked.push('Ya estás matriculado en este estudio')
    } else if (profile.pending_payment_codes?.includes(study.code)) {
      reasons_blocked.push('Ya tenés una matrícula pendiente de pago para este estudio — subí tu comprobante desde tu perfil para activarla')
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
      // Etapa Intermedia usa el criterio de asistencia REFORZADO (el doble de
      // asistencias, misma ventana y misma recencia) — el resto de etapas
      // sigue con el criterio general. Mismo helper (meetsAttendanceCriteria),
      // solo cambia el mínimo exigido.
      const isIntermedia = study.stage === 'intermedia'
      const attendanceOk = isIntermedia ? !!profile.attendance_active_intermedia : profile.attendance_active
      const minCharlas = isIntermedia ? ATTENDANCE_MIN_CHARLAS_INTERMEDIA : ATTENDANCE_MIN_CHARLAS
      if (attendanceOk) reasons_met.push('Asistís regularmente a las charlas ✓')
      else if (isWaived('attendance')) reasons_met.push('Requisito de asistencia eximido por excepción ✓')
      else reasons_blocked.push(`Requiere asistencia activa: al menos ${minCharlas} charlas con check-in en los últimos ${ATTENDANCE_MONTHS} meses, con al menos una en los últimos ${ATTENDANCE_RECENCY_DAYS} días (llevás ${profile.charla_count} en los últimos ${ATTENDANCE_MONTHS} meses)`)
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
            // Grupos virtuales: ocultos por completo salvo autorización activa
            // del miembro — no se ofrecen ni se pueden matricular sin ella.
            const virtualOk = !g.is_virtual || !!profile.authorized_virtual_studies
            return g.study_type_id === study.code && g.status === 'en_matricula' && active < g.max_capacity && ageOk && virtualOk
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
              is_virtual: !!g.is_virtual,
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
