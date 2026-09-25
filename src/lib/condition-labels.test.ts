import { describe, it, expect } from 'vitest'
import { conditionLabel } from './condition-labels'
import type { FilterCondition } from '@/types/filters'

// FIL-1: chips de la condición de asistencia con negación y evento puntual.
function attend(over: Partial<Extract<FilterCondition, { type: 'attendance' }>> = {}): FilterCondition {
  return {
    id: 1, group: 'attend', type: 'attendance',
    eventType: '', sedes: [], camp: '', attendanceType: 'any',
    qtyOp: 'any', qty: '', from: '', to: '',
    ...over,
  }
}

describe('conditionLabel — attendance (FIL-1)', () => {
  it('sin refinamiento mantiene el label histórico', () => {
    expect(conditionLabel(attend())).toBe('Asistencia')
    expect(conditionLabel(attend({ eventType: 'charla', eventTypeName: 'Charla' }))).toBe('Charla')
  })

  it('negate antepone "No asistió"', () => {
    expect(conditionLabel(attend({ negate: true }))).toBe('No asistió: Asistencia')
    expect(conditionLabel(attend({ negate: true, eventTypeName: 'Campamento', eventType: 'campamento' })))
      .toBe('No asistió: Campamento')
  })

  it('el evento puntual manda sobre el tipo', () => {
    const c = attend({ eventId: 'x', eventName: 'Campamento Verano 2026 · 15 ene 2026', eventTypeName: 'Campamento' })
    expect(conditionLabel(c)).toBe('Campamento Verano 2026 · 15 ene 2026')
    expect(conditionLabel({ ...c, negate: true } as FilterCondition))
      .toBe('No asistió: Campamento Verano 2026 · 15 ene 2026')
  })

  it('registration: inscrito/no inscrito con estado del tiquete (FIL-2)', () => {
    const base = {
      id: 2, group: 'attend', type: 'registration',
      eventId: '', eventType: '', ticketStatus: 'any', from: '', to: '',
    } as const
    expect(conditionLabel({ ...base } as FilterCondition)).toBe('Inscrito: Evento')
    expect(conditionLabel({ ...base, negate: true, eventName: 'Congreso 2026' } as FilterCondition))
      .toBe('No inscrito: Congreso 2026')
    expect(conditionLabel({ ...base, ticketStatus: 'paid', eventTypeName: 'Campamento' } as FilterCondition))
      .toBe('Inscrito: Campamento (pagado)')
  })

  it('conserva el sufijo de cantidad', () => {
    expect(conditionLabel(attend({ qtyOp: 'gte', qty: '3', eventTypeName: 'Charla', eventType: 'charla' })))
      .toBe('Charla ≥3×')
    expect(conditionLabel(attend({ negate: true, qtyOp: 'gte', qty: '3', eventTypeName: 'Charla', eventType: 'charla' })))
      .toBe('No asistió: Charla ≥3×')
  })
})

// El chip rápido "Servidores" solo sabe afirmar; esta condición además niega.
describe('server', () => {
  const cond = (value: 'yes' | 'no') =>
    ({ id: 9, group: 'server', type: 'server', value }) as FilterCondition

  it('distingue sirve de no sirve', () => {
    expect(conditionLabel(cond('yes'))).toBe('Sirve actualmente')
    expect(conditionLabel(cond('no'))).toBe('No sirve actualmente')
  })
})

describe('PAR-5 · el chip del filtro de estudio', () => {
  const study = (over: Partial<Extract<FilterCondition, { type: 'study' }>>) =>
    conditionLabel({ id: 1, group: 'study', type: 'study', study: 'N1', status: 'completed', from: null, to: null, ...over } as FilterCondition)

  it('sin plan dice «cualquier estudio», no «?»', () => {
    // Antes el vacío era imposible de crear y el label mostraba '?'.
    expect(study({ study: '', status: 'any' })).toContain('cualquier estudio')
  })

  it('«Cursando», no «En progreso»: la etiqueta vieja se leía como matriculado', () => {
    expect(study({ status: 'in_progress' })).toMatch(/^Cursando: /)
    expect(study({ study: '', status: 'in_progress' })).toBe('Cursando un estudio')
  })

  it('los otros estados no cambiaron', () => {
    expect(study({ status: 'completed' })).toMatch(/^Completó: /)
    expect(study({ status: 'not_taken' })).toMatch(/^No llevó: /)
  })
})

/**
 * PAR-5b · El chip tiene que avisar que la condición está NEGADA. Un filtro que
 * quita gente y se ve igual que uno que la suma es una trampa.
 */
describe('condiciones negadas', () => {
  it('antepone «Excepto —»', () => {
    expect(conditionLabel({
      id: 1, group: 'study', type: 'study', study: 'N1',
      status: 'in_progress', from: null, to: null, negate: true,
    })).toBe('Excepto — Cursando: N1 — Nivel 1')
  })

  it('sin negar, el chip no cambia', () => {
    expect(conditionLabel({
      id: 1, group: 'donor', type: 'donor', value: 'yes',
    })).toBe('Donante')
    expect(conditionLabel({
      id: 1, group: 'donor', type: 'donor', value: 'yes', negate: true,
    })).toBe('Excepto — Donante')
  })

  it('asistencia e inscripción conservan SU redacción', () => {
    // «No asistió» suena mejor que «Excepto — Asistencia» y ya existía antes de
    // que la negación fuera general; cambiarlo habría movido chips que la gente
    // ya reconoce.
    const a = conditionLabel({
      id: 1, group: 'attend', type: 'attendance', eventType: '', eventTypeName: 'Charla',
      sedes: [], camp: '', attendanceType: 'any', qtyOp: 'any', qty: '', from: '', to: '', negate: true,
    })
    expect(a.startsWith('No asistió')).toBe(true)
    expect(a).not.toContain('Excepto')
  })
})
