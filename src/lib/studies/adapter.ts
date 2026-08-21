// Adapta filas de Supabase a los tipos de dominio de estudios (StudyType, StudyGroup).

import type {
  DbStudyPlan, DbGroupEnriched, DbLeaderEnriched,
} from '@/lib/supabase/queries/studies'
import type {
  StudyType, StudyGroup, GroupParticipant, StudyLeader, LeaderEvaluation,
} from '@/types/study'
// Mapa nivel→etapa: fuente única en eligibility.ts (QA 2026-07-17).
import { LEVEL_TO_STAGE } from '@/lib/studies/eligibility'
import { hasRestriction, normalizeRestriction } from '@/lib/studies/group-restrictions'

export function toDomainStudyType(db: DbStudyPlan): StudyType {
  // El frontend usa `id` como clave de catálogo (== code en el mock).
  const code = db.code ?? db.id
  return {
    id: code,
    plan_id: db.id,
    code,
    name: db.name,
    description: db.description ?? null,
    difficulty: db.difficulty ?? null,
    commitments: db.commitments ?? null,
    mentor_id: db.mentor_id ?? null,
    mentor_name: db.mentor ? `${db.mentor.first_name} ${db.mentor.last_name}`.trim() : null,
    stage: LEVEL_TO_STAGE[db.level] ?? 'niveles',
    weeks: db.duration_weeks ?? 0,
    prerequisite: db.prerequisite_code,
    requires_payment: db.requires_payment,
    requires_invitation: (db as { requires_invitation?: boolean }).requires_invitation ?? false,
    cost: db.cost,
    currency: db.currency ?? 'CRC',
    requires_grade: db.requires_grade,
    auto_promote: db.auto_promote,
    next_study_id: db.next_study_code,
    req_donor: db.requires_donor,
    req_server: db.requires_server,
    req_attendee: db.requires_attendance,
    req_bus: db.requires_bus_talk ?? false,
    is_archived: !db.is_active,
    is_curricular: db.is_curricular ?? true,
  }
}

function mapParticipantStatus(
  s: DbGroupEnriched['enrollments'][number]['status'],
): GroupParticipant['status'] {
  if (s === 'enrolled' || s === 'completed') return 'enrolled'
  if (s === 'waitlist' || s === 'pendiente_de_pago') return 'pending'
  return 'withdrawn' // dropped | transferred | expirada
}

/** Entrada del adapter de grupos: detalle (enrollments completos) o item de
 *  listado (solo enrollment_counts — C5 auditoría 2026-06-11). */
export type DbGroupForDomain = Omit<DbGroupEnriched, 'enrollments'> & {
  enrollments?: DbGroupEnriched['enrollments']
  enrollment_counts?: { enrolled: number; pending: number; withdrawn: number }
}

// Participantes "fantasma" para el listado: las vistas de lista solo CUENTAN
// participants por status (nunca leen member_id/nombre ahí); el detalle usa
// getGroupById, que sí trae los enrollments reales.
function stubParticipants(counts: { enrolled: number; pending: number; withdrawn: number }): GroupParticipant[] {
  const stub = (status: GroupParticipant['status'], n: number): GroupParticipant[] =>
    Array.from({ length: n }, () => ({
      member_id: '', member_name: '', status, grade: null, attendance_pct: 0,
    }))
  return [
    ...stub('enrolled', counts.enrolled),
    ...stub('pending', counts.pending),
    ...stub('withdrawn', counts.withdrawn),
  ]
}

export function toDomainStudyGroup(db: DbGroupForDomain & { viewer_scope?: 'admin' | 'leader' | 'member' | 'none' }): StudyGroup {
  const leaderName = db.leader ? `${db.leader.first_name} ${db.leader.last_name}`.trim() : null
  const coLeaderName = db.co_leader ? `${db.co_leader.first_name} ${db.co_leader.last_name}`.trim() : null

  const participants: GroupParticipant[] = db.enrollments
    ? db.enrollments.map((e) => ({
        member_id: e.member_id,
        member_name: e.member ? `${e.member.first_name} ${e.member.last_name}`.trim() : '',
        status: mapParticipantStatus(e.status),
        // Resultado del cierre según notes ('aprobado' | 'reprobado: <motivo>').
        result: e.notes?.startsWith('reprobado') ? 'reprobado' as const
          : e.notes === 'aprobado' || e.status === 'completed' ? 'aprobado' as const
          : null,
        grade: e.grade,
        // attendance_pct se calcula en la vista de detalle (Fase 2b) con study_attendance.
        attendance_pct: 0,
      }))
    : stubParticipants(db.enrollment_counts ?? { enrolled: 0, pending: 0, withdrawn: 0 })

  return {
    viewer_scope: db.viewer_scope,
    id: db.id,
    name: db.name ?? '',
    study_type_id: db.plan?.code ?? '',
    leader_id: db.leader_id,
    co_leader_id: db.co_leader_id ?? null,
    leader_name: leaderName,
    co_leader_name: coLeaderName,
    // GRU-3 · Contacto del dirigente. Solo llega en el DETALLE del grupo y solo
    // para quien lo gestiona: el endpoint lo borra para el resto.
    leader_phone: db.leader?.phone ?? null,
    leader_email: db.leader?.email ?? null,
    co_leader_phone: db.co_leader?.phone ?? null,
    co_leader_email: db.co_leader?.email ?? null,
    zone: db.zone ?? '',
    schedule_days: db.schedule_days ?? [],
    schedule_time: db.schedule_time ?? '',
    location: db.location ?? '',
    max_capacity: db.max_students ?? 0,
    age_min: db.age_min ?? null,
    age_max: db.age_max ?? null,
    start_date: db.starts_at ?? '',
    end_date: db.ends_at,
    enrollment_start_date: db.enrollment_start_date ?? null,
    enrollment_end_date: db.enrollment_end_date ?? null,
    status: db.status,
    current_week: db.current_week,
    participants,
    whatsapp_group_url: db.whatsapp_group_url,
    is_leader_training: db.is_leader_training ?? false,
    training_modality: db.training_modality ?? null,
    is_virtual: db.is_virtual ?? false,
    has_restriction: hasRestriction(normalizeRestriction(db.enrollment_restrictions)),
  }
}

// ── Líderes ───────────────────────────────────────────────────────────────────

const AVAIL_MAP: Record<DbLeaderEnriched['availability_status'], StudyLeader['availability_status']> = {
  available: 'available',
  assigned: 'assigned',
  resting: 'resting',
  en_revision: 'en_revision',
  inactive: 'inactive',
}

/** Convierte un dirigente. Los `stats` se derivan de `groups` (los grupos ya
 *  cargados en dominio), y los `commitments` del miembro. */
// `ledGroups` ya viene pre-filtrado (los grupos que lidera este miembro) para
// evitar O(leaders × groups) — ver useStudies.
export function toDomainStudyLeader(db: DbLeaderEnriched, ledGroups: StudyGroup[]): StudyLeader {
  const memberName = db.member ? `${db.member.first_name} ${db.member.last_name}`.trim() : ''
  const activeGroups = ledGroups.filter((g) => g.status === 'en_matricula' || g.status === 'en_curso')
  const currentParticipants = activeGroups.reduce(
    (sum, g) => sum + g.participants.filter((p) => p.status === 'enrolled').length, 0,
  )
  const avgRating = db.evaluations.length
    ? db.evaluations.reduce((s, e) => s + e.score, 0) / db.evaluations.length
    : 0

  const evaluations: LeaderEvaluation[] = db.evaluations.map((e) => ({
    id: e.id,
    group_id: e.group_id ?? '',
    group_name: ledGroups.find((g) => g.id === e.group_id)?.study_type_id ?? '',
    score: e.score,
    date: e.evaluation_date,
    comments: e.comments ?? '',
  }))

  return {
    id: db.id,
    member_id: db.member_id,
    member_name: memberName,
    zone_preference: db.zone_preference ?? [],
    availability_status: AVAIL_MAP[db.availability_status] ?? 'available',
    is_active: db.is_active,
    qualified_studies: db.qualified_study_codes ?? [],
    formation_studies: db.formation_study_codes ?? [],
    stats: {
      groups_led: ledGroups.length,
      avg_rating: Math.round(avgRating * 10) / 10,
      current_participants: currentParticipants,
    },
    commitments: {
      is_donor: db.member?.is_donor ?? false,
      // attends_charlas e is_server se derivan de asistencia/voluntariado (Fase 2b).
      attends_charlas: false,
      is_server: false,
    },
    evaluations,
  }
}

