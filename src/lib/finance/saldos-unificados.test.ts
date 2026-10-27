/** Una sola lista de «a quién le debemos plata» (Floriana, 2026-10-27). */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { unificarSaldos, totalVigentePorMoneda, personasConSaldo, coincide, ETIQUETA_TIPO, type CreditoEnLista } from './saldos-unificados'
import type { SaldoAFavor } from './saldo-a-favor'

const sobrante = (x: Partial<SaldoAFavor> = {}): SaldoAFavor => ({
  enrollment_id: 'e1', member_id: 'm1', member_name: 'Adriana Mora', group_name: 'Nivel 1 · Lunes',
  costo: 5000, currency: 'CRC', pagado: 20000, saldo: 15000, generado_en: '2026-10-07T10:00:00Z', ...x,
})
const credito = (x: Partial<CreditoEnLista> = {}): CreditoEnLista => ({
  id: 'c1', status: 'active', monto: 5000, currency: 'CRC', vence: '2027-01-22', motivo: 'Theos cerró el grupo',
  origen: 'Sirviendo como Jesús', origin_payment_id: 'p1', member_id: 'm2', member_name: 'Raquel Ulate',
  created_at: '2026-10-07T06:00:00Z', pago_descripcion: 'Matrícula · SCJ', ...x,
})

describe('la lista unificada', () => {
  it('cada fila dice de qué tipo es y conserva su fuente', () => {
    const filas = unificarSaldos([sobrante()], [credito()], '2026-10-27')
    expect(filas.map(f => f.tipo)).toEqual(['sobrante', 'congelado'])
    expect(filas[0].fuente.tipo).toBe('sobrante')
    expect(filas[1].fuente.tipo).toBe('congelado')
    expect(ETIQUETA_TIPO.sobrante).toBe('Sobrante de matrícula')
    expect(ETIQUETA_TIPO.congelado).toBe('Matrícula congelada')
  })

  it('lo vigente primero, de mayor a menor; lo usado o vencido al final', () => {
    const filas = unificarSaldos(
      [sobrante({ saldo: 3000 })],
      [credito({ id: 'a', monto: 25000, status: 'used' }), credito({ id: 'b', monto: 5000 }), credito({ id: 'c', monto: 15000, vence: '2026-01-01' })],
      '2026-10-27',
    )
    expect(filas.map(f => `${f.key}:${f.estado}`)).toEqual([
      'congelado:b:vigente', 'sobrante:e1:vigente', 'congelado:a:usado', 'congelado:c:vencido',
    ])
  })

  it('un crédito REVOCADO no sale: es una corrección, no un saldo', () => {
    // Irene Arias: pago devuelto y crédito encima; «es una devolución únicamente».
    const filas = unificarSaldos([], [credito({ status: 'revoked' }), credito({ id: 'ok' })], '2026-10-27')
    expect(filas.map(f => f.key)).toEqual(['congelado:ok'])
  })

  it('el sobrante no vence; el crédito sí, y su «generado» es cuándo se emitió', () => {
    const [s, c] = unificarSaldos([sobrante()], [credito()], '2026-10-27')
    expect(s.vence).toBeNull()
    expect(c.vence).toBe('2027-01-22')
    expect(c.generado_en).toBe('2026-10-07T06:00:00Z')
  })
})

describe('los totales', () => {
  it('suman SOLO lo vigente, por moneda, de las dos fuentes', () => {
    const filas = unificarSaldos(
      [sobrante({ saldo: 15000 }), sobrante({ enrollment_id: 'e2', currency: 'USD', saldo: 20 })],
      [credito(), credito({ id: 'x', monto: 99999, status: 'used' })],
      '2026-10-27',
    )
    expect(totalVigentePorMoneda(filas)).toEqual([{ currency: 'CRC', total: 20000 }, { currency: 'USD', total: 20 }])
  })

  it('una persona con sobrante Y crédito cuenta una vez; la que solo tiene usado, cero', () => {
    const filas = unificarSaldos(
      [sobrante({ member_id: 'm2' })],
      [credito({ member_id: 'm2' }), credito({ id: 'z', member_id: 'm3', status: 'used' })],
      '2026-10-27',
    )
    expect(personasConSaldo(filas)).toBe(1)
  })
})

describe('la búsqueda', () => {
  it('encuentra por persona, por origen y por tipo', () => {
    const [s, c] = unificarSaldos([sobrante()], [credito()], '2026-10-27')
    expect(coincide(s, 'adriana')).toBe(true)
    expect(coincide(c, 'sirviendo')).toBe(true)
    expect(coincide(c, 'congelada')).toBe(true)
    expect(coincide(s, 'congelada')).toBe(false)
    expect(coincide(s, '  ')).toBe(true)
  })
})

describe('el cableado', () => {
  it('la pantalla usa UNA tabla con la columna Tipo y abre el detalle de cada fuente', () => {
    const p = readFileSync('src/app/(admin)/finanzas/saldos/page.tsx', 'utf8')
    expect(p).toContain('unificarSaldos(')
    expect(p).toContain("'Tipo'")
    expect(p).not.toContain('SeccionDeCreditos')
    expect(p).toContain('<DetalleDeSaldo')
    expect(p).toContain('<DetalleDeCredito')
    // El link de las campanas a finanzas sigue aterrizando.
    expect(p).toContain('id="creditos"')
  })
})
