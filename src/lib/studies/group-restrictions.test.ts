// GRU-2 · Restricción de audiencia por grupo.
//
// Lo que se fija acá es el contrato que usan la matrícula, el guard del endpoint
// y la UI: qué se guarda, cómo se lee y a quién se le ofrece cada grupo.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  ALLOWED_RESTRICTION_TYPES, isAllowedRestrictionType, normalizeRestriction,
  hasRestriction, restrictionSummary, restrictionBlockedMessage,
  RESTRICTION_ERROR_CODE, type GroupRestriction,
} from './group-restrictions'
import { computeEligibility } from './eligibility'
import type { StudyType, StudyGroup } from '@/types/study'

const DIRIGENTE = { id: 1, group: 'leader', type: 'leader', value: 'yes' } as const
const COMPLETO_N1 = { id: 2, group: 'study', type: 'study', study: 'N1', status: 'completed', from: null, to: null } as const

const soloDirigentes: GroupRestriction = { conditions: [DIRIGENTE], groups: [], ops: {} }

describe('qué condiciones se permiten', () => {
  it('las de audiencia sí', () => {
    for (const t of ['leader', 'service', 'study', 'age', 'marital', 'donor']) {
      expect(isAllowedRestrictionType(t)).toBe(true)
    }
  })

  it('las caras y las que no describen a una persona, no', () => {
    for (const t of ['attendance', 'registration', 'form', 'account', 'created', 'status']) {
      expect(isAllowedRestrictionType(t)).toBe(false)
    }
    expect(ALLOWED_RESTRICTION_TYPES).toHaveLength(6)
  })
})

describe('normalizeRestriction', () => {
  it('sin condiciones devuelve null: guardar vacío ABRE el grupo', () => {
    expect(normalizeRestriction(null)).toBeNull()
    expect(normalizeRestriction({ conditions: [], groups: [], ops: {} })).toBeNull()
    expect(normalizeRestriction('cualquier cosa')).toBeNull()
  })

  it('descarta las condiciones de tipos no permitidos', () => {
    const r = normalizeRestriction({
      conditions: [DIRIGENTE, { id: 9, group: 'created', type: 'created', from: '2020-01-01', to: '' }],
      groups: [], ops: {},
    })
    expect(r?.conditions).toHaveLength(1)
    expect(r?.conditions[0].type).toBe('leader')
  })

  it('si TODO era de un tipo no permitido, queda null (no un grupo que no ofrece a nadie)', () => {
    const r = normalizeRestriction({
      conditions: [{ id: 1, group: 'account', type: 'account', value: 'active' }], groups: [], ops: {},
    })
    expect(r).toBeNull()
  })

  it('tira los grupos y ops que apuntan a condiciones inexistentes', () => {
    const r = normalizeRestriction({
      conditions: [DIRIGENTE, COMPLETO_N1],
      groups: [{ id: 1, members: [1, 2, 77], op: 'OR' }, { id: 2, members: [99], op: 'AND' }],
      ops: { g1: 'AND', c2: 'OR', c404: 'OR', g2: 'AND' },
    })
    expect(r?.groups).toHaveLength(1)
    expect(r?.groups[0].members).toEqual([1, 2])
    expect(Object.keys(r!.ops).sort()).toEqual(['c2', 'g1'])
  })
})

describe('resumen legible', () => {
  it('una condición', () => {
    expect(restrictionSummary(soloDirigentes)).toBe('Dirigente')
  })

  it('dos condiciones sueltas se leen con "y"', () => {
    const r = normalizeRestriction({ conditions: [DIRIGENTE, COMPLETO_N1], groups: [], ops: {} })!
    expect(restrictionSummary(r)).toBe('Dirigente y Completó: N1 — Nivel 1')
  })

  it('un grupo OR se lee entre paréntesis', () => {
    const r = normalizeRestriction({
      conditions: [DIRIGENTE, COMPLETO_N1],
      groups: [{ id: 1, members: [1, 2], op: 'OR' }],
      ops: {},
    })!
    expect(restrictionSummary(r)).toBe('(Dirigente o Completó: N1 — Nivel 1)')
  })

  it('sin restricción, resumen vacío', () => {
    expect(restrictionSummary(null)).toBe('')
    expect(hasRestriction(null)).toBe(false)
    expect(hasRestriction(soloDirigentes)).toBe(true)
  })

  it('el mensaje del bloqueo dice POR QUÉ, no un error genérico', () => {
    expect(restrictionBlockedMessage(soloDirigentes)).toBe('Este grupo es solo para: Dirigente.')
    expect(RESTRICTION_ERROR_CODE).toBe('restriccion_grupo')
  })
})

// ── La restricción dentro de la elegibilidad ─────────────────────────────────

const PLAN_ABIERTO: StudyType = {
  id: 'p1', code: 'CAP', name: 'Capacitación', stage: 'niveles', weeks: 8,
  prerequisite: null, req_donor: false, req_server: false, req_attendee: false,
  requires_payment: false, cost: null,
} as unknown as StudyType

const PLAN_INTERMEDIA: StudyType = {
  ...PLAN_ABIERTO, id: 'p2', code: 'INT', name: 'Intermedia', stage: 'intermedia',
  req_donor: true, req_server: true, req_attendee: true,
} as unknown as StudyType

function grupo(id: string, code: string, extra: Partial<StudyGroup> = {}): StudyGroup {
  return {
    id, study_type_id: code, leader_id: null, leader_name: 'Ana', zone: 'CEN',
    schedule_days: ['L'], schedule_time: '19:00', location: '', max_capacity: 10,
    age_min: null, age_max: null, start_date: '2026-09-01', end_date: null,
    status: 'en_matricula', current_week: 0, participants: [], whatsapp_group_url: null,
    ...extra,
  } as StudyGroup
}

const PERFIL = {
  completed_codes: [], current_code: null, is_donor: true, is_server: true,
  charla_count: 20, attendance_active: true, attendance_active_intermedia: true,
}

describe('elegibilidad con restricción de grupo', () => {
  it('un grupo SIN restricción se comporta igual que siempre', () => {
    const [r] = computeEligibility([PLAN_ABIERTO], [grupo('g1', 'CAP')], PERFIL)
    expect(r.is_eligible).toBe(true)
    expect(r.available_groups.map(g => g.group_id)).toEqual(['g1'])
  })

  it('un grupo restringido NO se ofrece a quien no lo cumple', () => {
    const [r] = computeEligibility(
      [PLAN_ABIERTO],
      [grupo('g1', 'CAP', { has_restriction: true })],
      PERFIL,
      { passedRestrictedGroups: new Set<string>() },
    )
    expect(r.is_eligible).toBe(true)          // el PLAN sigue disponible…
    expect(r.available_groups).toHaveLength(0) // …pero ese grupo no se le ofrece
  })

  it('sí se ofrece a quien la cumple', () => {
    const [r] = computeEligibility(
      [PLAN_ABIERTO],
      [grupo('g1', 'CAP', { has_restriction: true })],
      PERFIL,
      { passedRestrictedGroups: new Set(['g1']) },
    )
    expect(r.available_groups.map(g => g.group_id)).toEqual(['g1'])
  })

  it('dos grupos del MISMO plan con restricciones distintas se ofrecen distinto', () => {
    const [r] = computeEligibility(
      [PLAN_ABIERTO],
      [grupo('abierto', 'CAP'), grupo('solo-dirigentes', 'CAP', { has_restriction: true })],
      PERFIL,
      { passedRestrictedGroups: new Set<string>() },
    )
    expect(r.available_groups.map(g => g.group_id)).toEqual(['abierto'])
  })

  it('la restricción NO reemplaza los compromisos de la etapa', () => {
    // Cumple la restricción del grupo, pero no la asistencia de Intermedia.
    const [r] = computeEligibility(
      [PLAN_INTERMEDIA],
      [grupo('g1', 'INT', { has_restriction: true })],
      { ...PERFIL, attendance_active: false, attendance_active_intermedia: false },
      { passedRestrictedGroups: new Set(['g1']) },
    )
    expect(r.is_eligible).toBe(false)
    expect(r.available_groups).toHaveLength(0)
    expect(r.reasons_blocked.join(' ')).toMatch(/asistencia/i)
  })

  it('sin el dato calculado, un grupo restringido se OCULTA (default conservador)', () => {
    const [r] = computeEligibility([PLAN_ABIERTO], [grupo('g1', 'CAP', { has_restriction: true })], PERFIL)
    expect(r.available_groups).toHaveLength(0)
  })
})

describe('el grupo sucesor NO hereda la restricción', () => {
  it('el insert del sucesor no copia enrollment_restrictions', () => {
    // Guard de código: al cerrar una cohorte el sucesor hereda dirigente,
    // horario y zona a propósito — la restricción de audiencia NO.
    const src = readFileSync('src/lib/supabase/queries/payments.ts', 'utf8')
    const insert = src.slice(src.indexOf('plan_id: nextPlanId'), src.indexOf(".select('id').single()"))
      .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')  // sin los comentarios
    expect(insert).not.toContain('enrollment_restrictions')
  })
})
