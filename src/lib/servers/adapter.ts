// Adapta filas de Supabase a los tipos de dominio de servidores.

import type {
  DbCommittee, DbVacancy, DbApplication, DbCommitteeGoal,
} from '@/lib/supabase/queries/servers'
import type {
  CommitteeData, CommitteeServer, Vacancy, Application, CommitteeGoal,
} from '@/types/server'

function fullName(m: { first_name: string; last_name: string } | null): string {
  return m ? `${m.first_name} ${m.last_name}`.trim() : ''
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
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
        initials: initials(name),
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
      initials: initials(leaderName),
    },
    ideal_capacity: db.ideal_capacity ?? 0,
    members,
    positions: db.positions.map((p) => ({ id: p.id, title: p.title })),
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
    applicant_initials: initials(applicantName),
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
