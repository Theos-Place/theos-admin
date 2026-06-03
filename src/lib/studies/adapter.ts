// Adapta filas de Supabase a los tipos de dominio de estudios (StudyType, StudyGroup).

import type { DbStudyPlan, DbGroupEnriched } from '@/lib/supabase/queries/studies'
import type { StudyType, StudyGroup, GroupParticipant } from '@/types/study'

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
    code,
    name: db.name,
    stage: LEVEL_TO_STAGE[db.level] ?? 'niveles',
    weeks: db.duration_weeks ?? 0,
    prerequisite: db.prerequisite_code,
    requires_payment: db.requires_payment,
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
    study_type_id: db.plan?.code ?? '',
    leader_id: db.leader_id,
    leader_name: leaderName,
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
