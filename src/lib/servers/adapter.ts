// Adapta filas de Supabase a los tipos de dominio de servidores.

import type {
  DbCommittee, DbVacancy, DbApplication, DbCommitteeGoal,
} from '@/lib/supabase/queries/servers'
import type {
  CommitteeData, CommitteeServer, Vacancy, Application, CommitteeGoal,
} from '@/types/server'
import { getInitials } from '@/lib/format'

function fullName(m: { first_name: string; last_name: string } | null): string {
  return m ? `${m.first_name} ${m.last_name}`.trim() : ''
}

/** Convierte un comité. `openVacancies` se pasa aparte (derivado de vacancies). */
export function toDomainCommittee(db: DbCommittee, openVacancies = 0): CommitteeData {
  const leaderName = fullName(db.leader)
  const members: CommitteeServer[] = db.positions.flatMap((pos) =>
    pos.volunteers.map((v) => {
      const name = fullName(v.member)
      return {
        member_id: v.member_id,
        name,
        initials: getInitials(name),
        position: pos.title,
        position_id: pos.id,
        start_date: v.start_date ?? '',
        status: (v.status === 'active' ? 'active' : 'inactive') as CommitteeServer['status'],
        email: v.member?.email ?? null,
        phone: v.member?.phone ?? null,
        birth_date: v.member?.birth_date ?? null,
      }
    }),
  )

  return {
    id: db.id,
    name: db.name,
    // El embed self-FK de parent es poco fiable en PostgREST; usamos parent_id directo
    // como area_code (coincide con el id de área que expone useOrg para agrupar/filtrar).
    area: db.parent?.name ?? '',
    area_code: db.parent_id ?? db.parent?.id ?? '',
    leader: {
      member_id: db.leader_id ?? '',
      name: leaderName,
      initials: getInitials(leaderName),
    },
    ideal_capacity: db.ideal_capacity ?? 0,
    members,
    positions: db.positions.map((p) => ({
      id: p.id,
      title: p.title,
      active_count: p.volunteers.filter((v) => v.status === 'active' || v.status === 'on_leave').length,
      description: p.description,
      functions: p.functions,
      profile: p.profile,
      skills: p.skills,
      study_requirement: p.study_requirement,
    })),
    open_vacancies: openVacancies,
  }
}

export function toDomainVacancy(db: DbVacancy): Vacancy {
  return {
    id: db.id,
    committee_id: db.committee_id,
    committee_name: db.committee?.name ?? '',
    area: db.committee?.parent?.name ?? '',
    title: db.title,
    position: db.position ?? '',
    description: db.description ?? '',
    functions: db.functions ?? [],
    schedule: db.schedule ?? '',
    commitment: db.commitment ?? '',
    slots_total: db.slots_total,
    slots_filled: db.slots_filled,
    status: db.status,
    published_at: db.published_at,
    created_at: db.created_at,
    application_count: Array.isArray(db.applications) ? (db.applications[0]?.count ?? 0) : 0,
    position_description: db.pos?.description ?? null,
    position_functions: db.pos?.functions ?? null,
    position_profile: db.pos?.profile ?? null,
    position_skills: db.pos?.skills ?? null,
    position_study_requirement: db.pos?.study_requirement ?? null,
    expires_at: db.expires_at ?? null,
    location: db.location ?? null,
    notes: db.notes ?? null,
    is_featured: !!db.is_featured,
  }
}

export function toDomainApplication(db: DbApplication): Application {
  const applicantName = fullName(db.applicant)
  return {
    id: db.id,
    vacancy_id: db.vacancy_id,
    vacancy_title: db.vacancy?.title ?? '',
    committee_id: db.vacancy?.committee?.id ?? '',
    committee_name: db.vacancy?.committee?.name ?? '',
    area: db.vacancy?.committee?.parent?.name ?? '',
    position: db.vacancy?.position ?? '',
    applicant_id: db.applicant_id,
    applicant_name: applicantName,
    applicant_initials: getInitials(applicantName),
    applied_at: db.applied_at,
    status: db.status,
    notes: db.notes ?? '',
    // service_history se carga en la vista de detalle del aplicante (Fase 2b).
    service_history: [],
  }
}

export function toDomainCommitteeGoal(db: DbCommitteeGoal): CommitteeGoal {
  return {
    id: db.id,
    description: db.description,
    status: db.status,
    due_date: db.due_date,
  }
}
