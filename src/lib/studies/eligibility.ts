// Elegibilidad de matrícula sobre datos reales (planes + grupos de dominio).
// Versión server-side de la lógica que antes vivía en enrollment-eligibility.ts (mock).

import type { StudyType, StudyGroup } from '@/types/study'
import { ATTENDANCE_MONTHS, ATTENDANCE_MIN_CHARLAS, ATTENDANCE_MIN_CHARLAS_INTERMEDIA, ATTENDANCE_RECENCY_DAYS } from '@/lib/attendance'
import { isEnrollmentWindowOpen } from '@/lib/studies/enrollment-window'

/** Mapa nivel de BD → etapa de dominio. Fuente ÚNICA (QA 2026-07-17: estaba
 *  triplicado en adapter.ts, studies-demand.ts y studies-eligibility.ts). */
export const LEVEL_TO_STAGE: Record<string, StudyType['stage']> = {
  niveles: 'niveles',
  etapa_inicial: 'inicial',
  etapa_intermedia: 'intermedia',
  // EST-5: etapa Avanzada (CDEB, HER, CDC) — compromisos de intermedia + solo
  // por invitación (requires_invitation en el plan).
  etapa_avanzada: 'avanzada',
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
  // EST-5: avanzada pide LOS MISMOS compromisos que intermedia (la invitación
  // es aparte, vía requires_invitation del plan).
  if (stage === 'intermedia' || stage === 'avanzada') return { donor: true, server: true, attendance: 'intermedia' }
  return { donor: false, server: false, attendance: 'none' } // niveles y campañas: sin compromisos
}

/** MAT-1: estado ESTRUCTURADO de los requisitos (para resúmenes de UI que no
 *  deben parsear los strings de reasons_*). undefined = el requisito no aplica
 *  a este plan; true = cumplido (o eximido); false = falta. */
export type RequirementsStatus = {
  /** Código del prerequisito FALTANTE (null si no aplica o ya está cumplido/eximido). */
  missing_prerequisite: string | null
  donor?: boolean
  server?: boolean
  attendance?: boolean
  /** Detalle largo del criterio de asistencia (tooltip/texto secundario). */
  attendance_detail?: string
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
  requirements: RequirementsStatus
  available_groups: EligibleGroup[]
}

export type EligibleGroup = {
  group_id: string
  zone: string
  /** Dónde se reúne, dentro de la zona ("Casa de la familia Rojas", "Salón 3").
   *  La zona sola no alcanza para llegar, y quien se matricula lo necesita
   *  ANTES de elegir grupo, no después. Vacía en los virtuales. */
  location: string
  schedule_days: string
  schedule_time: string
  leader_name: string
  spots_available: number
  max_capacity: number
  filled: number
  start_date: string
  requires_payment: boolean
  cost: number | null
  /** INT-3: moneda del costo del plan; sin ella la pantalla asumiría colones. */
  currency: string | null
  is_virtual: boolean
}

export type MemberStudyProfile = {
  completed_codes: string[]
  current_code: string | null
  /** Todos los códigos con matrícula 'enrolled' (PRE-5: requisito prematrimonial). */
  enrolled_codes?: string[]
  /** PAG-2 · Deuda de matrícula que bloquea. Se calcula desde la tabla
   *  `payments` (no desde el estado de la matrícula), así que refleja lo mismo
   *  que el guard del servidor. `planCodes` son los estudios de la propia
   *  deuda: esos NO se bloquean, porque el camino de quien debe N3 es pagar su
   *  N3, no quedarse sin poder tocar nada. */
  blocking_debt?: { count: number; total: number; currency: string; planCodes: string[] }
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
  /** FIN-2: ¿tiene documento de identidad registrado? Toda matrícula lo exige
   *  (guard bloqueante en enrollMember); la UI lo pide antes de confirmar. */
  has_document?: boolean
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

/** El motivo de bloqueo por deuda. Se exporta para que la pantalla lo detecte y
 *  muestre su tarjeta explicativa con el enlace, en vez de repetir el string. */
export const DEBT_BLOCK_REASON = 'Tenés un pago de matrícula pendiente'

export function computeEligibility(
  plans: StudyType[],
  groups: StudyGroup[],
  profile: MemberStudyProfile,
  /** GRU-1: hoy (YYYY-MM-DD) para la ventana de matrícula de los grupos. Sin
   *  este arg la ventana no se evalúa (compatibilidad con llamadas viejas).
   *
   *  GRU-2 `passedRestrictedGroups`: ids de los grupos RESTRINGIDOS que este
   *  miembro sí cumple (los resuelve el caller contra la base). Un grupo con
   *  restricción que no esté en el set NO se ofrece — a propósito el default es
   *  conservador: si el caller no lo calcula, el grupo restringido se oculta en
   *  vez de ofrecerse de más. */
  opts?: { todayYmd?: string; passedRestrictedGroups?: ReadonlySet<string> },
): EligibilityResult[] {
  const invitedCodes = new Set(profile.invited_codes ?? [])
  return plans
    // Invitation_only: ocultos por completo salvo invitación activa (A7).
    .filter(study => !study.requires_invitation || invitedCodes.has(study.code))
    .map(study => {
    const reasons_blocked: string[] = []
    const reasons_met: string[] = []
    const requirements: RequirementsStatus = { missing_prerequisite: null }
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
        requirements.missing_prerequisite = study.prerequisite
      }
    } else {
      reasons_met.push('No requiere estudios previos')
    }

    // 1.b PAG-2 · Deuda de matrícula pendiente. Va acá, en el MISMO cálculo que
    // usa la pantalla, para que la lista no ofrezca un estudio que el servidor
    // va a rechazar: antes el aviso salía arriba pero las tarjetas seguían con
    // su botón, y la persona se enteraba al fallar la matrícula.
    // Espejo exacto de countBlockingStudyPayments: el plan de la propia deuda
    // queda exento.
    const deuda = profile.blocking_debt
    if (deuda && deuda.count > 0 && !deuda.planCodes.includes(study.code)) {
      reasons_blocked.push(DEBT_BLOCK_REASON)
    }

    // 2. No está cursándolo.
    //
    // Acá vivía además una rama para el estado 'pendiente_de_pago', del modelo
    // viejo en que la matrícula quedaba retenida hasta el pago. Ese estado se
    // retiró el 2026-08-04 (matrícula y pago en carriles separados: la
    // matrícula es efectiva de inmediato) y ya no se escribe — al 2026-08-24
    // hay 0 filas con ese estado, así que la rama no podía dispararse nunca.
    //
    // La deuda SÍ bloquea, pero en otro lado y mejor: los guards PAG-2 y FIN-4
    // de enrollMember() miran la tabla `payments`, no el estado de la
    // matrícula, así que también agarran los tractos vencidos.
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
      requirements.donor = profile.is_donor || isWaived('donor')
      if (profile.is_donor) reasons_met.push('Sos donador activo ✓')
      else if (isWaived('donor')) reasons_met.push('Requisito de donador eximido por excepción ✓')
      else reasons_blocked.push('Requiere ser donador activo de Theos')
    }
    if (study.req_server) {
      requirements.server = profile.is_server || isWaived('server')
      if (profile.is_server) reasons_met.push('Servís activamente en un comité ✓')
      else if (isWaived('server')) reasons_met.push('Requisito de servidor eximido por excepción ✓')
      else reasons_blocked.push('Requiere servir activamente en un comité')
    }
    if (study.req_attendee) {
      // Etapa Intermedia usa el criterio de asistencia REFORZADO (el doble de
      // asistencias, misma ventana y misma recencia) — el resto de etapas
      // sigue con el criterio general. Mismo helper (meetsAttendanceCriteria),
      // solo cambia el mínimo exigido.
      const isIntermedia = study.stage === 'intermedia' || study.stage === 'avanzada'
      const attendanceOk = isIntermedia ? !!profile.attendance_active_intermedia : profile.attendance_active
      const minCharlas = isIntermedia ? ATTENDANCE_MIN_CHARLAS_INTERMEDIA : ATTENDANCE_MIN_CHARLAS
      requirements.attendance = attendanceOk || isWaived('attendance')
      requirements.attendance_detail = `Al menos ${minCharlas} charlas con check-in en los últimos ${ATTENDANCE_MONTHS} meses, con al menos una en los últimos ${ATTENDANCE_RECENCY_DAYS} días (llevás ${profile.charla_count}).`
      if (attendanceOk) reasons_met.push('Asistís regularmente a las charlas ✓')
      else if (isWaived('attendance')) reasons_met.push('Requisito de asistencia eximido por excepción ✓')
      else reasons_blocked.push(`Requiere asistencia activa: al menos ${minCharlas} charlas con check-in en los últimos ${ATTENDANCE_MONTHS} meses, con al menos una en los últimos ${ATTENDANCE_RECENCY_DAYS} días (llevás ${profile.charla_count} en los últimos ${ATTENDANCE_MONTHS} meses)`)
    }

    const is_eligible = reasons_blocked.length === 0

    // Los grupos se calculan SIEMPRE, no solo si la persona es elegible.
    // `available_groups` significa "grupos abiertos de este estudio que te
    // calzan" (edad, virtual, restricción) — una propiedad del grupo, no de si
    // cumplís los requisitos. Antes salía vacío al estar bloqueado, y eso hacía
    // que la pantalla escondiera el estudio por completo: con una deuda la
    // lista quedaba vacía y decía "no hay grupos abiertos", que era falso.
    // Todo lo que MATRICULA sigue detrás de is_eligible.
    const available_groups: EligibleGroup[] = groups
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
            // GRU-1: solo se ofrecen grupos dentro de su ventana de matrícula
            // (sin fechas = siempre; sin todayYmd no se evalúa).
            const windowOk = !opts?.todayYmd
              || isEnrollmentWindowOpen(g.enrollment_start_date, g.enrollment_end_date, opts.todayYmd)
            // GRU-2: la restricción de audiencia del GRUPO se suma a todo lo
            // anterior (etapa, compromisos, prerequisitos), nunca lo reemplaza.
            const restrictionOk = !g.has_restriction
              || !!opts?.passedRestrictedGroups?.has(g.id)
            return g.study_type_id === study.code && g.status === 'en_matricula' && active < g.max_capacity && ageOk && virtualOk && windowOk && restrictionOk
          })
          .map(g => {
            const active = g.participants.filter(p => p.status !== 'withdrawn').length
            return {
              group_id: g.id,
              zone: g.zone,
              location: g.is_virtual ? '' : (g.location ?? ''),
              schedule_days: formatDays(g.schedule_days),
              schedule_time: g.schedule_time,
              leader_name: g.leader_name ?? 'Sin asignar',
              spots_available: g.max_capacity - active,
              max_capacity: g.max_capacity,
              filled: active,
              start_date: g.start_date,
              requires_payment: study.requires_payment,
              cost: study.cost ?? null,
              currency: study.currency ?? null,
              is_virtual: !!g.is_virtual,
            }
          })

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
      requirements,
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
