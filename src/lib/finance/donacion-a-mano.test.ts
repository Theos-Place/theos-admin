import { describe, it, expect } from 'vitest'
import { normalizarDonacion, MENSAJES } from './donacion-a-mano'

const HOY = '2026-09-18'
const PERSONA = '11111111-1111-4111-8111-111111111111'
const base = { member_id: PERSONA, donation_date: '2026-09-15' }

describe('normalizarDonacion', () => {
  it('lo mínimo: persona y fecha', () => {
    const r = normalizarDonacion(base, HOY)
    expect(r.ok && r.datos).toEqual({
      member_id: PERSONA, donation_date: '2026-09-15', amount: null, currency: 'CRC', note: null,
    })
  })

  it('EL PUNTO DE DON-2: sin monto se guarda NULL, nunca 0', () => {
    // Cero es un monto real: sumaría en los reportes y se vería "₡0" en vez de
    // "sin monto". Son cosas distintas.
    for (const v of [undefined, null, '', '   ']) {
      const r = normalizarDonacion({ ...base, amount: v }, HOY)
      expect(r.ok && r.datos.amount, String(v)).toBeNull()
    }
  })

  it('pero un 0 escrito a propósito SÍ se guarda como 0', () => {
    const r = normalizarDonacion({ ...base, amount: 0 }, HOY)
    expect(r.ok && r.datos.amount).toBe(0)
  })

  it('el monto puede venir como texto: el input lo manda así', () => {
    const r = normalizarDonacion({ ...base, amount: '25000' }, HOY)
    expect(r.ok && r.datos.amount).toBe(25000)
  })

  it('un monto negativo se rechaza, y el mensaje dice qué hacer', () => {
    const r = normalizarDonacion({ ...base, amount: -5 }, HOY)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(MENSAJES[r.motivo]).toMatch(/vac[íi]o/i)
  })

  it('un monto que no es número se rechaza', () => {
    expect(normalizarDonacion({ ...base, amount: 'veinte mil' }, HOY).ok).toBe(false)
  })

  it('sin persona no hay donación', () => {
    expect(normalizarDonacion({ ...base, member_id: '' }, HOY).ok).toBe(false)
    expect(normalizarDonacion({ ...base, member_id: 'no-es-uuid' }, HOY).ok).toBe(false)
  })

  it('UNA DONACIÓN FUTURA es siempre un error de tecleo', () => {
    const r = normalizarDonacion({ ...base, donation_date: '2026-09-19' }, HOY)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('fecha_futura')
  })

  it('pero el pasado NO se acota: se cargan reportes viejos', () => {
    expect(normalizarDonacion({ ...base, donation_date: '2019-03-01' }, HOY).ok).toBe(true)
  })

  it('hoy sí vale', () => {
    expect(normalizarDonacion({ ...base, donation_date: HOY }, HOY).ok).toBe(true)
  })

  it('fechas mal escritas no revientan', () => {
    for (const f of ['', 'ayer', '15/09/2026', '2026-13-01', '2026-09-15T10:00:00Z']) {
      expect(normalizarDonacion({ ...base, donation_date: f }, HOY).ok, f).toBe(false)
    }
  })

  it('la moneda por defecto es colones, y se acepta en minúscula', () => {
    expect(normalizarDonacion(base, HOY).ok && normalizarDonacion(base, HOY).ok).toBe(true)
    const r = normalizarDonacion({ ...base, currency: 'usd' }, HOY)
    expect(r.ok && r.datos.currency).toBe('USD')
  })

  it('una moneda inventada se rechaza — NUNCA se convierte (INT-3)', () => {
    const r = normalizarDonacion({ ...base, currency: 'BTC' }, HOY)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('moneda_desconocida')
  })

  it('la nota se recorta, y vacía queda en null', () => {
    expect(normalizarDonacion({ ...base, note: '  Para el Edificio  ' }, HOY))
      .toMatchObject({ ok: true, datos: { note: 'Para el Edificio' } })
    expect(normalizarDonacion({ ...base, note: '   ' }, HOY))
      .toMatchObject({ ok: true, datos: { note: null } })
  })
})
