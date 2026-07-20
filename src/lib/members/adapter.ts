// Adapta una fila `DbMemberEnriched` (Supabase + relaciones) al tipo de dominio
// completo `Member`. Los campos pesados (attendance_history, donations,
// form_responses, family_members) siguen vacíos en el list view — se cargan
// en la página de detalle del miembro (Fase 2b).

import type { DbMember, DbMemberEnriched, DbMemberFull } from '@/lib/supabase/queries/members'
import type { Member, ServiceRecord } from '@/types/member'
import { calcAge } from '@/lib/format'
import { esComiteDirigentes } from '@/lib/dirigentes'

/** Convierte un `DbMemberEnriched` a `Member`. Acepta también un `DbMember` plano
 *  (usa defaults para los campos derivados que faltan). */
export function toDomainMember(db: DbMemberEnriched | DbMember): Member {
  const enriched = 'roles' in db ? db as DbMemberEnriched : null

  const activeService = enriched?.active_service ?? null
  // Dirigente activo = servidor activo en el comité Dirigentes (misma fuente
  // de verdad que lib/dirigentes), no el rol de acceso 'dirigente'.
  const esDirigente = esComiteDirigentes(enriched?.active_service?.committee)

  return {
    // ── Pasamos directo desde Supabase ──
    id: db.id,
    cedula: db.cedula,
    first_name: db.first_name,
    last_name: db.last_name,
    email: db.email,
    phone: db.phone,
    birth_date: db.birth_date,
    gender: db.gender,
    marital_status: db.marital_status,
    occupation: db.occupation,
    workplace: db.workplace,
    province: db.province,
    canton: db.canton,
    district: db.district,
    address: db.address,
    allergies: db.allergies,
    emergency_contact_name: db.emergency_contact_name,
    emergency_contact_phone: db.emergency_contact_phone,
    photo_url: db.photo_url,
    is_donor: db.is_donor,
    is_active: db.is_active,
    is_system: !!(db as { is_system?: boolean }).is_system,
    account_state: db.account_confirmed_at ? 'active' : (db.auth_user_id ? 'unconfirmed' : 'none'),
    deactivation_reason: db.deactivation_reason,
    deactivated_at: db.deactivated_at,
    created_at: db.created_at,
    updated_at: db.updated_at,
    field_updated_at: ('field_updated_at' in db ? db.field_updated_at : null) ?? null,

    // ── Derivados (Fase 2a) ──
    is_server: enriched?.is_server ?? false,
    roles: enriched?.roles ?? [],
    completed_studies: enriched?.completed_studies ?? [],
    current_study: enriched?.current_study ?? null,
    current_study_week: enriched?.current_study_week ?? null,
    sede: enriched?.sede?.code ?? '',
    sede_case: (enriched as DbMemberEnriched | null)?.sede_case ?? null,
    sede_last_checkin: (enriched as DbMemberEnriched | null)?.sede_last_checkin ?? null,
    es_dirigente: esDirigente,
    is_dirigente: enriched?.is_dirigente ?? esDirigente,

    // ── Service history: sólo el activo en list view (Fase 2b: historia completa) ──
    service_history: activeService
      ? [{
          position: activeService.position,
          committee: activeService.committee,
          area: activeService.area,
          from: activeService.from ?? '',
          to: null,
          status: 'activo',
        }]
      : [],

    // ── Pendientes Fase 2b (detail view) ──
    age: calcAge(db.birth_date),
    tipos_evento: [],
    comites: enriched?.active_service ? [enriched.active_service.committee] : [],
    estado_dirigente: enriched?.estado_dirigente ?? null,
    join_date: db.created_at,
    medicamentos: db.medications,
    attendance_history: [],
    attendance_months: enriched?.attendance_months ?? [],
    family_members: [],
    donations: [],
    form_responses: [],
    wallet_pass_status: 'not_generated',
  }
}

// ── Fase 2b: convertir DbMemberFull (con histórico) → Member ─────────────────

function mapVolunteerStatus(s: 'active' | 'inactive' | 'on_leave' | 'pending'): ServiceRecord['status'] {
  return s === 'active' ? 'activo' : 'finalizado'
}

export function toDomainMemberFull(db: DbMemberFull): Member {
  // Reutilizamos toDomainMember para los campos comunes
  const base = toDomainMember(db)

  const attendanceHistory = db.attendance.map(a => ({
    name: a.event_name,
    date: a.event_date,
    type: a.event_type,
    attendance_type: (a.was_volunteer ? 'servidor' : 'participante') as 'participante' | 'servidor',
  }))

  const serviceHistory: ServiceRecord[] = db.service_history.map(s => ({
    position: s.position,
    committee: s.committee,
    area: s.area,
    from: s.from ?? '',
    to: s.to,
    status: mapVolunteerStatus(s.status),
  }))

  const donations = db.donations.map(d => ({
    date: d.date,
    amount: d.amount,
    description: d.description,
  }))

  const formResponses = db.form_responses.map(r => ({
    formId: r.form_slug ?? r.form_id,
    submittedAt: r.submitted_at,
    answers: r.answers,
  }))

  const familyMembers = db.family.map(f => ({
    id: f.id,
    name: f.name,
    relation: f.relation,
    status: (f.is_active ? 'active' : 'inactive') as 'active' | 'inactive',
  }))

  // tipos_evento: distintos event_types presentes en attendance_history
  const tiposEvento = Array.from(new Set(attendanceHistory.map(a => a.type)))

  // comités: distintos committees activos del historial de servicio
  const comites = Array.from(
    new Set(
      serviceHistory
        .filter(s => s.status === 'activo' && s.committee)
        .map(s => s.committee),
    ),
  )

  return {
    ...base,
    attendance_sede: db.attendance_sede ?? null,
    study_history: db.study_history ?? [],
    event_registration_history: db.event_registration_history ?? [],
    attendance_history: attendanceHistory,
    service_history: serviceHistory,
    donations,
    form_responses: formResponses,
    family_members: familyMembers,
    tipos_evento: tiposEvento,
    comites,
    es_dirigente: comites.some(c => esComiteDirigentes(c)),
    wallet_pass_status: db.wallet_pass_id ? 'active' : 'not_generated',
    attendance_active: db.attendance_active,
    last_charla_checkin: db.last_charla_checkin,
    led_groups: db.led_groups ?? [],
    led_studies: db.led_studies ?? [],
  }
}
