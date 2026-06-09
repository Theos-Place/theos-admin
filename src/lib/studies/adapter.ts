// Adapta filas de Supabase a los tipos de dominio de estudios (StudyType, StudyGroup).

import type {
  DbStudyPlan, DbGroupEnriched, DbLeaderEnriched, DbWaitlistEntry, DbRelocation,
} from '@/lib/supabase/queries/studies'
import type {
  StudyType, StudyGroup, GroupParticipant, StudyLeader, LeaderEvaluation,
  WaitListEntry, RelocationRequest,
} from '@/types/study'

function ageFrom(birthDate: string | null): number {
  if (!birthDate) return 0
  const today = new Date()
  const nac = new Date(birthDate)
  let age = today.getFullYear() - nac.getFullYear()
  const m = today.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < nac.getDate())) age--
  return age
}

const LEVEL_TO_STAGE: Record<DbStudyPlan['level'], StudyType['stage']> = {
  niveles: 'niveles',
  etapa_inicial: 'inicial',
  etapa_intermedia: 'intermedia',
  campanas: 'campaña',
}

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
    stage: LEVEL_TO_STAGE[db.level] ?? 'niveles',
    weeks: db.duration_weeks ?? 0,
    prerequisite: db.prerequisite_code,
    requires_payment: db.requires_payment,
    requires_invitation: (db as { requires_invitation?: boolean }).requires_invitation ?? false,
    cost: db.cost,
    requires_grade: db.requires_grade,
    auto_promote: db.auto_promote,
    next_study_id: db.next_study_code,
    req_donor: db.requires_donor,
    req_server: db.requires_server,
    req_attendee: db.requires_attendance,
    is_archived: !db.is_active,
  }
}

function mapParticipantStatus(
  s: DbGroupEnriched['enrollments'][number]['status'],
): GroupParticipant['status'] {
  if (s === 'enrolled' || s === 'completed') return 'enrolled'
  if (s === 'waitlist') return 'pending'
  return 'withdrawn' // dropped | transferred
}

export function toDomainStudyGroup(db: DbGroupEnriched): StudyGroup {
  const leaderName = db.leader ? `${db.leader.first_name} ${db.leader.last_name}`.trim() : null
  const coLeaderName = db.co_leader ? `${db.co_leader.first_name} ${db.co_leader.last_name}`.trim() : null

  const participants: GroupParticipant[] = db.enrollments.map((e) => ({
    member_id: e.member_id,
    member_name: e.member ? `${e.member.first_name} ${e.member.last_name}`.trim() : '',
    status: mapParticipantStatus(e.status),
    grade: e.grade,
    // attendance_pct se calcula en la vista de detalle (Fase 2b) con study_attendance.
    attendance_pct: 0,
  }))

  return {
    id: db.id,
    name: db.name ?? '',
    study_type_id: db.plan?.code ?? '',
    leader_id: db.leader_id,
    co_leader_id: db.co_leader_id ?? null,
    leader_name: leaderName,
    co_leader_name: coLeaderName,
    zone: db.zone ?? '',
    schedule_days: db.schedule_days ?? [],
    schedule_time: db.schedule_time ?? '',
    location: db.location ?? '',
    max_capacity: db.max_students ?? 0,
    start_date: db.starts_at ?? '',
    end_date: db.ends_at,
    status: db.status,
    current_week: db.current_week,
    participants,
    whatsapp_group_url: db.whatsapp_group_url,
  }
}

// ── Líderes ───────────────────────────────────────────────────────────────────

const AVAIL_MAP: Record<DbLeaderEnriched['availability_status'], StudyLeader['availability_status']> = {
  available: 'available',
  assigned: 'assigned',
  resting: 'resting',
  inactive: 'inactive',
}

/** Convierte un dirigente. Los `stats` se derivan de `groups` (los grupos ya
 *  cargados en dominio), y los `commitments` del miembro. */
export function toDomainStudyLeader(db: DbLeaderEnriched, groups: StudyGroup[]): StudyLeader {
  const memberName = db.member ? `${db.member.first_name} ${db.member.last_name}`.trim() : ''
  const ledGroups = groups.filter((g) => g.leader_id === db.member_id)
  const activeGroups = ledGroups.filter((g) => g.status === 'open' || g.status === 'in_progress')
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

// ── Waitlist y reubicaciones ──────────────────────────────────────────────────

export function toDomainWaitlistEntry(db: DbWaitlistEntry): WaitListEntry {
  return {
    id: db.id,
    member_id: db.member_id,
    member_name: db.member ? `${db.member.first_name} ${db.member.last_name}`.trim() : '',
    age: ageFrom(db.member?.birth_date ?? null),
    zone_preference: db.zone_preference ?? '',
    horario_preference: db.schedule_preference ?? '',
    requested_at: db.requested_at,
    type: db.type,
    campaign_code: db.campaign_code ?? undefined,
  }
}

export function toDomainRelocation(db: DbRelocation): RelocationRequest {
  return {
    id: db.id,
    member_id: db.member_id,
    member_name: db.member ? `${db.member.first_name} ${db.member.last_name}`.trim() : '',
    from_group_id: db.from_group_id ?? '',
    study_type: db.study_plan_code ?? '',
    reason: db.reason ?? '',
    status: db.status,
    requested_at: db.requested_at,
  }
}
