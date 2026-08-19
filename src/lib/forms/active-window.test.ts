import { describe, it, expect } from 'vitest'
import { formWindowStatus, windowStartToIso, windowEndToIso, isoToWindowYmd } from './active-window'

const now = new Date('2026-08-20T12:00:00-06:00')

describe('formWindowStatus', () => {
  it('apagado a mano → borrador, con o sin fechas', () => {
    expect(formWindowStatus({ is_active: false }, now)).toBe('borrador')
    expect(formWindowStatus({ is_active: false, starts_at: '2026-08-01T00:00:00-06:00' }, now)).toBe('borrador')
  })
  it('sin fechas → activo', () => {
    expect(formWindowStatus({ is_active: true }, now)).toBe('activo')
    expect(formWindowStatus({ is_active: true, starts_at: null, ends_at: null }, now)).toBe('activo')
  })
  it('antes del inicio → programado', () => {
    expect(formWindowStatus({ is_active: true, starts_at: '2026-09-01T00:00:00-06:00' }, now)).toBe('programado')
  })
  it('dentro de la ventana → activo (bordes inclusive)', () => {
    expect(formWindowStatus({
      is_active: true, starts_at: '2026-08-20T00:00:00-06:00', ends_at: '2026-08-20T23:59:59-06:00',
    }, now)).toBe('activo')
  })
  it('pasado el fin → vencido (cambia solo, sin cron)', () => {
    expect(formWindowStatus({ is_active: true, ends_at: '2026-08-19T23:59:59-06:00' }, now)).toBe('vencido')
  })
})

describe('conversión de fechas de la ventana (zona CR)', () => {
  it('inicio = 00:00 y fin = 23:59:59 del día, UTC-6', () => {
    expect(windowStartToIso('2026-08-20')).toBe('2026-08-20T00:00:00-06:00')
    expect(windowEndToIso('2026-08-20')).toBe('2026-08-20T23:59:59-06:00')
    expect(windowStartToIso(null)).toBeNull()
  })
  it('el viaje redondo conserva el día en zona CR', () => {
    expect(isoToWindowYmd(windowStartToIso('2026-08-20'))).toBe('2026-08-20')
    expect(isoToWindowYmd(windowEndToIso('2026-12-31'))).toBe('2026-12-31')
    expect(isoToWindowYmd(null)).toBe('')
  })
})
