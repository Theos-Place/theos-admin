import { describe, it, expect } from 'vitest'
import { computeEligibility, isRelocationEligibleCode, type MemberStudyProfile } from './eligibility'
import type { StudyType, StudyGroup } from '@/types/study'

// ── Factories mínimas ─────────────────────────────────────────────────────────

function plan(over: Partial<StudyType> & { code: string }): StudyType {
  return {
    id: over.code,
    name: `Plan ${over.code}`,
    stage: 'niveles',
    weeks: 10,
    prerequisite: null,
    requires_payment: false,
    cost: 0,
    requires_grade: false,
    auto_promote: false,
    next_study_id: null,
    req_donor: false,
    req_server: false,
    req_attendee: false,
    is_archived: false,
    ...over,
  } as StudyType
}

function group(over: Partial<StudyGroup> & { study_type_id: string }): StudyGroup {
  return {
    id: `g-${over.study_type_id}`,
    name: `Grupo ${over.study_type_id}`,
    leader_id: null,
    co_leader_id: null,
    leader_name: 'Dirigente X',
    zone: 'central',
    schedule_days: ['M'],
    schedule_time: '19:00',
    location: '',
    max_capacity: 20,
    start_date: '2026-09-14',
    status: 'en_matricula',
    current_week: 0,
    participants: [],
    whatsapp_group_url: null,
    ...over,
  } as StudyGroup
}

function profile(over: Partial<MemberStudyProfile> = {}): MemberStudyProfile {
  return {
    completed_codes: [],
    current_code: null,
    is_donor: false,
    is_server: false,
    charla_count: 0,
    attendance_active: false,
    ...over,
  }
}

const of = (results: ReturnType<typeof computeEligibility>, code: string) => {
  const r = results.find(x => x.study_code === code)
  if (!r) throw new Error(`sin resultado para ${code}`)
  return r
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('computeEligibility — prerequisitos y estados', () => {
  const n1 = plan({ code: 'N1' })
  const n2 = plan({ code: 'N2', prerequisite: 'N1' })
  const n3 = plan({ code: 'N3', prerequisite: 'N2' })
  const plans = [n1, n2, n3]

  it('sin historial: N1 elegible, N2 bloqueado por prerequisito', () => {
    const res = computeEligibility(plans, [], profile())
    expect(of(res, 'N1').is_eligible).toBe(true)
    expect(of(res, 'N2').is_eligible).toBe(false)
    expect(of(res, 'N2').reasons_blocked.join(' ')).toContain('Necesitás completar')
  })

  it('con N1 completado: N2 elegible, N1 bloqueado por completado', () => {
    const res = computeEligibility(plans, [], profile({ completed_codes: ['N1'] }))
    expect(of(res, 'N2').is_eligible).toBe(true)
    expect(of(res, 'N1').is_eligible).toBe(false)
    expect(of(res, 'N1').reasons_blocked.join(' ')).toContain('Ya completaste')
  })

  it('cursándolo: bloqueado por matrícula activa', () => {
    const res = computeEligibility(plans, [], profile({ current_code: 'N1' }))
    expect(of(res, 'N1').is_eligible).toBe(false)
    expect(of(res, 'N1').reasons_blocked.join(' ')).toContain('Ya estás matriculado')
  })

  it('pendiente de pago: bloqueado con mensaje de comprobante (fix 1.2, cierra bypass)', () => {
    const res = computeEligibility(plans, [], profile({ completed_codes: ['N1'], pending_payment_codes: ['N2'] }))
    expect(of(res, 'N2').is_eligible).toBe(false)
    expect(of(res, 'N2').reasons_blocked.join(' ')).toContain('pendiente de pago')
  })

  it('descendiente completado: quien llevó N3 no puede re-matricular N1', () => {
    const res = computeEligibility(plans, [], profile({ completed_codes: ['N3'] }))
    expect(of(res, 'N1').is_eligible).toBe(false)
    expect(of(res, 'N1').reasons_blocked.join(' ')).toContain('más avanzado')
  })
})

describe('computeEligibility — compromisos', () => {
  const dis1 = plan({ code: 'DIS1', stage: 'inicial', req_donor: true, req_attendee: true })

  it('sin donar ni asistir: ambos motivos bloqueados', () => {
    const res = computeEligibility([dis1], [], profile())
    const r = of(res, 'DIS1')
    expect(r.is_eligible).toBe(false)
    expect(r.reasons_blocked.some(m => m.includes('donador'))).toBe(true)
    expect(r.reasons_blocked.some(m => m.includes('charlas'))).toBe(true)
  })

  it('asistencia exige el criterio único (attendance_active): sin cumplirlo bloquea, cumpliéndolo pasa', () => {
    const casi = computeEligibility([dis1], [], profile({ is_donor: true, attendance_active: false }))
    expect(of(casi, 'DIS1').is_eligible).toBe(false)
    const justo = computeEligibility([dis1], [], profile({ is_donor: true, attendance_active: true }))
    expect(of(justo, 'DIS1').is_eligible).toBe(true)
  })

  it('excepción de matrícula exime requisitos puntuales', () => {
    const res = computeEligibility([dis1], [], profile({
      attendance_active: true,
      exceptions: { DIS1: ['donor'] },
    }))
    const r = of(res, 'DIS1')
    expect(r.is_eligible).toBe(true)
    expect(r.by_exception).toBe(true)
  })

  it('Etapa Intermedia exige el criterio de asistencia REFORZADO, no el general', () => {
    const dis2 = plan({ code: 'DIS2', stage: 'intermedia', req_donor: true, req_server: true, req_attendee: true })
    // Cumple el criterio general (6) pero no el reforzado (12): sigue bloqueado.
    const soloGeneral = computeEligibility([dis2], [], profile({
      is_donor: true, is_server: true, attendance_active: true, attendance_active_intermedia: false,
    }))
    const r1 = of(soloGeneral, 'DIS2')
    expect(r1.is_eligible).toBe(false)
    expect(r1.reasons_blocked.some(m => m.includes('12 charlas'))).toBe(true)

    // Cumple el reforzado: pasa.
    const cumpleReforzado = computeEligibility([dis2], [], profile({
      is_donor: true, is_server: true, attendance_active: true, attendance_active_intermedia: true,
    }))
    expect(of(cumpleReforzado, 'DIS2').is_eligible).toBe(true)
  })
})

describe('computeEligibility — invitación y grupos', () => {
  it('invitation_only se OCULTA sin invitación y aparece con ella', () => {
    const scj = plan({ code: 'SCJ', requires_invitation: true })
    const sin = computeEligibility([scj], [], profile())
    expect(sin.find(r => r.study_code === 'SCJ')).toBeUndefined()
    const con = computeEligibility([scj], [], profile({ invited_codes: ['SCJ'] }))
    expect(of(con, 'SCJ').by_invitation).toBe(true)
  })

  it('solo ofrece grupos en_matricula con cupo', () => {
    const n1 = plan({ code: 'N1' })
    const lleno = group({ id: 'lleno', study_type_id: 'N1', max_capacity: 1, participants: [
      { member_id: 'x', member_name: 'X', status: 'enrolled', grade: null, attendance_pct: 0 },
    ] })
    const enCurso = group({ id: 'curso', study_type_id: 'N1', status: 'en_curso' })
    const abierto = group({ id: 'abierto', study_type_id: 'N1' })
    const res = computeEligibility([n1], [lleno, enCurso, abierto], profile())
    expect(of(res, 'N1').available_groups.map(g => g.group_id)).toEqual(['abierto'])
  })

  it('los retirados NO ocupan cupo', () => {
    const n1 = plan({ code: 'N1' })
    const g = group({ study_type_id: 'N1', max_capacity: 1, participants: [
      { member_id: 'x', member_name: 'X', status: 'withdrawn', grade: null, attendance_pct: 0 },
    ] })
    const res = computeEligibility([n1], [g], profile())
    expect(of(res, 'N1').available_groups).toHaveLength(1)
  })

  it('rango de edad del grupo: fuera de rango no se ofrece; sin edad conocida sí', () => {
    const n1 = plan({ code: 'N1' })
    const jovenes = group({ study_type_id: 'N1', age_min: 18, age_max: 25 })
    const con40 = computeEligibility([n1], [jovenes], profile({ member_age: 40 }))
    expect(of(con40, 'N1').available_groups).toHaveLength(0)
    const sinEdad = computeEligibility([n1], [jovenes], profile({ member_age: null }))
    expect(of(sinEdad, 'N1').available_groups).toHaveLength(1)
  })
})

describe('isRelocationEligibleCode', () => {
  it('niveles, cadena DIS y SCJ sí; otros no', () => {
    expect(isRelocationEligibleCode('N1')).toBe(true)
    expect(isRelocationEligibleCode('DIS3')).toBe(true)
    expect(isRelocationEligibleCode('SCJ')).toBe(true)
    expect(isRelocationEligibleCode('BUS')).toBe(false)
    expect(isRelocationEligibleCode(null)).toBe(false)
  })
})
