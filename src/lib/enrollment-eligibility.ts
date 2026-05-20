import { STUDY_CATALOG } from '@/data/study-catalog'
import { MOCK_GROUPS, STUDY_TYPES } from '@/data/mock-studies'
import type { Member } from '@/data/mock-members'

export type EligibilityResult = {
  study_code: string
  study_name: string
  stage: string
  weeks: number
  is_eligible: boolean
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

const DAY_LABELS: Record<string, string> = {
  L: 'Lunes', M: 'Martes', X: 'Miércoles',
  J: 'Jueves', V: 'Viernes', S: 'Sábado', D: 'Domingo',
}

function formatDays(days: string[]): string {
  const labels = days.map(d => DAY_LABELS[d] ?? d)
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} y ${labels[1]}`
  return labels.slice(0, -1).join(', ') + ' y ' + labels[labels.length - 1]
}

export function getEligibleStudies(member: Member): EligibilityResult[] {
  return STUDY_CATALOG.map(study => {
    const reasons_blocked: string[] = []
    const reasons_met: string[] = []

    // 1. Prerequisito de estudio anterior
    if (study.prerequisite) {
      const hasPrereq = member.completed_studies?.includes(study.prerequisite as string)
      const prereqName = STUDY_CATALOG.find(s => s.code === study.prerequisite)?.name
      if (hasPrereq) {
        reasons_met.push(`Completaste ${prereqName}`)
      } else {
        reasons_blocked.push(`Necesitás completar ${prereqName} primero`)
      }
    } else {
      reasons_met.push('No requiere estudios previos')
    }

    // 2. No está cursando actualmente
    if (member.current_study === study.code) {
      reasons_blocked.push('Ya estás matriculado en este estudio')
    }

    // 3. No lo completó ya
    if (member.completed_studies?.includes(study.code as string)) {
      reasons_blocked.push('Ya completaste este estudio')
    }

    // 4. Compromisos requeridos
    const studyType = STUDY_TYPES.find(s => s.code === study.code)
    if (studyType) {
      if (studyType.req_donor) {
        if (member.is_donor) {
          reasons_met.push('Sos donador activo ✓')
        } else {
          reasons_blocked.push('Requiere ser donador activo de Theos')
        }
      }
      if (studyType.req_server) {
        const isServer = member.service_history?.some(s => s.status === 'activo' && s.to === null)
        if (isServer) {
          reasons_met.push('Servís activamente en un comité ✓')
        } else {
          reasons_blocked.push('Requiere servir activamente en un comité')
        }
      }
      if (studyType.req_attendee) {
        const charlaCount = member.attendance_history?.filter(
          a => a.type === 'Charla mensual' || a.type === 'Charla semanal'
        ).length ?? 0
        if (charlaCount >= 4) {
          reasons_met.push('Asistís regularmente a las charlas ✓')
        } else {
          reasons_blocked.push('Requiere asistencia regular a las charlas (con check-in)')
        }
      }
    }

    const is_eligible = reasons_blocked.length === 0

    const available_groups: EligibleGroup[] = is_eligible
      ? MOCK_GROUPS
          .filter(g => {
            const active = g.participants.filter(p => p.status !== 'withdrawn').length
            return g.study_type_id === study.code && g.status === 'open' && active < g.max_capacity
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
              requires_payment: studyType?.requires_payment ?? false,
              cost: studyType?.cost ?? null,
            }
          })
      : []

    return {
      study_code: study.code,
      study_name: study.name,
      stage: study.stage,
      weeks: study.weeks,
      is_eligible,
      reasons_blocked,
      reasons_met,
      available_groups,
    }
  })
}
