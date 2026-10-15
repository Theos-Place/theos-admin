import { describe, it, expect } from 'vitest'
import { solapamientoDeLaSerie, mensajeDeSolapamiento } from './solapamiento-de-la-serie'

const CR = 'America/Costa_Rica'

describe('solapamientoDeLaSerie · los casos reales de prod (2026-10-15)', () => {
  it('Cárcel de Menores: viernes 15:30 con fin el viernes siguiente 17:30 → se pisa', () => {
    const s = solapamientoDeLaSerie({ is_recurring: true, recurrence_rule: 'WEEKLY:FRI', timezone: CR,
      starts_at: '2026-10-16T21:30:00Z', ends_at: '2026-10-23T23:30:00Z' })
    expect(s).not.toBeNull()
    expect(s!.separacionMs).toBe(7 * 86_400_000)
  })
  it('Calles AM: cada dos sábados, fin a los 14 días → se pisa', () => {
    expect(solapamientoDeLaSerie({ is_recurring: true, recurrence_rule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=SA', timezone: CR,
      starts_at: '2026-10-10T15:00:00Z', ends_at: '2026-10-24T17:00:00Z' })).not.toBeNull()
  })
  it('Campa: sábado y domingo, del sábado 7:00 al domingo 18:00 → se pisa (es un evento de dos días)', () => {
    expect(solapamientoDeLaSerie({ is_recurring: true, recurrence_rule: 'WEEKLY:SAT,SUN', timezone: CR,
      starts_at: '2026-09-26T13:00:00Z', ends_at: '2026-09-28T00:00:00Z' })).not.toBeNull()
  })
})

describe('lo que SÍ es válido', () => {
  it('viernes de 15:30 a 17:30', () => {
    expect(solapamientoDeLaSerie({ is_recurring: true, recurrence_rule: 'WEEKLY:FRI', timezone: CR,
      starts_at: '2026-10-16T21:30:00Z', ends_at: '2026-10-16T23:30:00Z' })).toBeNull()
  })
  it('un retiro de fin de semana que se repite cada mes', () => {
    expect(solapamientoDeLaSerie({ is_recurring: true, recurrence_rule: 'FREQ=MONTHLY;BYDAY=1FR', timezone: CR,
      starts_at: '2026-11-07T00:00:00Z', ends_at: '2026-11-09T00:00:00Z' })).toBeNull()
  })
  it('un evento que cruza la medianoche, semanal', () => {
    expect(solapamientoDeLaSerie({ is_recurring: true, recurrence_rule: 'WEEKLY:SAT', timezone: CR,
      starts_at: '2026-10-18T02:00:00Z', ends_at: '2026-10-18T08:00:00Z' })).toBeNull()
  })
  it('sin repetición o sin fin, no aplica', () => {
    expect(solapamientoDeLaSerie({ is_recurring: false, recurrence_rule: 'WEEKLY:FRI',
      starts_at: '2026-10-16T21:30:00Z', ends_at: '2026-10-30T23:30:00Z' })).toBeNull()
    expect(solapamientoDeLaSerie({ is_recurring: true, recurrence_rule: 'WEEKLY:FRI',
      starts_at: '2026-10-16T21:30:00Z', ends_at: null })).toBeNull()
  })
})

describe('el mensaje', () => {
  it('dice cuánto dura, cada cuánto se repite y qué hacer', () => {
    const m = mensajeDeSolapamiento({ duracionMs: (7 * 24 + 2) * 3_600_000, separacionMs: 7 * 86_400_000 })
    expect(m).toContain('7 días y 2 horas')
    expect(m).toContain('a los 7 días')
    expect(m).toContain('quitá la repetición')
  })
})
