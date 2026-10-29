import { describe, it, expect } from 'vitest'
import { asistenciaPorSubEvento, NOMBRE_DEL_PRINCIPAL } from './asistencia-por-sub-evento'

const REF = '2026-10-28T19:00:00-06:00'
const SUBS = [{ id: 'youth', name: 'Youth' }, { id: 'kids', name: 'Kids' }]
const ci = (member_id: string, sub: string | null, extra: Record<string, unknown> = {}) => ({
  member_id, sub_event_id: sub, checked_at: REF, member_first_checkin_at: '2025-01-01T00:00:00Z', ...extra,
})

describe('asistenciaPorSubEvento (EVE-10)', () => {
  it('una fila por sub-evento, con asistentes, servidores y personas nuevas', () => {
    const filas = asistenciaPorSubEvento([
      ci('a', null), ci('b', null, { attendance_type: 'server' }),
      ci('c', 'youth'), ci('d', 'youth', { member_first_checkin_at: REF }), ci('e', 'youth', { checked_in_as: 'servidor' }),
    ], SUBS, REF)
    expect(filas.map(f => f.nombre)).toEqual([NOMBRE_DEL_PRINCIPAL, 'Youth', 'Kids'])
    expect(filas[0].calidad).toEqual({ total: 2, asistentes: 1, servidores: 1 })
    expect(filas[1].calidad).toEqual({ total: 3, asistentes: 2, servidores: 1 })
    expect(filas[1].nuevos.nuevas).toBe(1)
    expect(filas[2].calidad.total).toBe(0)
  })

  it('sin check-ins en el principal no pinta esa fila', () => {
    const filas = asistenciaPorSubEvento([ci('c', 'youth')], SUBS, REF)
    expect(filas.map(f => f.nombre)).toEqual(['Youth', 'Kids'])
  })

  it('un sub-evento que ya no existe cae en el principal, no se pierde', () => {
    const filas = asistenciaPorSubEvento([ci('x', 'borrado')], SUBS, REF)
    expect(filas[0].nombre).toBe(NOMBRE_DEL_PRINCIPAL)
    expect(filas[0].calidad.total).toBe(1)
  })
})
