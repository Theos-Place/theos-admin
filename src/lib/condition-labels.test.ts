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

  it('conserva el sufijo de cantidad', () => {
    expect(conditionLabel(attend({ qtyOp: 'gte', qty: '3', eventTypeName: 'Charla', eventType: 'charla' })))
      .toBe('Charla ≥3×')
    expect(conditionLabel(attend({ negate: true, qtyOp: 'gte', qty: '3', eventTypeName: 'Charla', eventType: 'charla' })))
      .toBe('No asistió: Charla ≥3×')
  })
})
