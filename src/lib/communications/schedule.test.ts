// Programación de comunicados: la hora elegida es la de SU zona, no la del navegador.
import { describe, it, expect } from 'vitest'
import {
  zonedToUtc, resolveScheduledAt, isBroadcastDue, scheduleSummary, SCHEDULED_STATUS,
} from './schedule'

describe('de hora local + zona a instante', () => {
  it('Costa Rica no tiene horario de verano: siempre -6', () => {
    expect(zonedToUtc('2026-08-10T15:30', 'America/Costa_Rica')).toBe('2026-08-10T21:30:00.000Z')
    expect(zonedToUtc('2026-01-10T15:30', 'America/Costa_Rica')).toBe('2026-01-10T21:30:00.000Z')
  })

  it('EL CASO QUE IMPORTA: Madrid cambia de +1 a +2 con el horario de verano', () => {
    // Agosto: CEST (+2) → las 15:30 de Madrid son las 13:30 UTC.
    expect(zonedToUtc('2026-08-10T15:30', 'Europe/Madrid')).toBe('2026-08-10T13:30:00.000Z')
    // Enero: CET (+1) → las 15:30 son las 14:30 UTC. Un offset fijo fallaría acá.
    expect(zonedToUtc('2026-01-10T15:30', 'Europe/Madrid')).toBe('2026-01-10T14:30:00.000Z')
  })

  it('el este de EE.UU. también cambia', () => {
    expect(zonedToUtc('2026-08-10T09:00', 'America/New_York')).toBe('2026-08-10T13:00:00.000Z')
    expect(zonedToUtc('2026-01-10T09:00', 'America/New_York')).toBe('2026-01-10T14:00:00.000Z')
  })

  it('medianoche no se corre de día', () => {
    expect(zonedToUtc('2026-08-10T00:00', 'America/Costa_Rica')).toBe('2026-08-10T06:00:00.000Z')
  })

  it('texto que no es fecha no revienta', () => {
    expect(zonedToUtc('', 'America/Costa_Rica')).toBeNull()
    expect(zonedToUtc('mañana', 'America/Costa_Rica')).toBeNull()
  })
})

describe('validación de lo que eligió el usuario', () => {
  const ahora = new Date('2026-08-10T12:00:00.000Z')

  it('una hora futura pasa y devuelve el instante', () => {
    const r = resolveScheduledAt('2026-08-10T15:30', 'America/Costa_Rica', ahora)
    expect(r).toEqual({ ok: true, iso: '2026-08-10T21:30:00.000Z' })
  })

  it('una hora que YA PASÓ se rechaza: si no, saldría de inmediato', () => {
    const r = resolveScheduledAt('2026-08-10T05:00', 'America/Costa_Rica', ahora)
    expect(r).toEqual({ ok: false, error: 'en_el_pasado' })
  })

  it('sin fecha, con el toggle encendido, se avisa', () => {
    expect(resolveScheduledAt('', 'America/Costa_Rica', ahora))
      .toEqual({ ok: false, error: 'sin_fecha' })
  })

  it('dentro del próximo tick SÍ se acepta: "en 5 minutos" es legítimo', () => {
    const r = resolveScheduledAt('2026-08-10T06:05', 'America/Costa_Rica', ahora)
    expect(r.ok).toBe(true)
  })
})

describe('a quién le toca salir', () => {
  const ahora = new Date('2026-08-10T12:00:00.000Z')

  it('vencido, sí', () => {
    expect(isBroadcastDue({ status: SCHEDULED_STATUS, scheduled_at: '2026-08-10T11:59:00Z' }, ahora)).toBe(true)
  })

  it('ATRASADO también: si un barrido falla, el siguiente lo recoge', () => {
    expect(isBroadcastDue({ status: SCHEDULED_STATUS, scheduled_at: '2026-08-09T00:00:00Z' }, ahora)).toBe(true)
  })

  it('todavía no, no', () => {
    expect(isBroadcastDue({ status: SCHEDULED_STATUS, scheduled_at: '2026-08-10T12:01:00Z' }, ahora)).toBe(false)
  })

  it('un borrador o uno ya enviado NUNCA salen por acá', () => {
    expect(isBroadcastDue({ status: 'draft', scheduled_at: '2026-08-01T00:00:00Z' }, ahora)).toBe(false)
    expect(isBroadcastDue({ status: 'sent', scheduled_at: '2026-08-01T00:00:00Z' }, ahora)).toBe(false)
    expect(isBroadcastDue({ status: SCHEDULED_STATUS, scheduled_at: null }, ahora)).toBe(false)
  })
})

describe('lo que se le muestra a quien programa', () => {
  it('se lee en SU zona, no en UTC', () => {
    const t = scheduleSummary('2026-08-10T13:30:00.000Z', 'Europe/Madrid')
    expect(t).toContain('3:30')
    expect(t).toContain('Madrid')
  })
})
