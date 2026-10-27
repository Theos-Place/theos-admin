/**
 * FIN-9 · El crédito por congelamiento tiene que VERSE: en el pago, en el
 * perfil y en finanzas. Caso real: tres créditos de SCJ existían y nadie los
 * veía (2026-10-27).
 */
import { describe, it, expect } from 'vitest'
import {
  estadoDelCredito, etiquetaCongelado, lineaDeCreditoEnPerfil, creditosVigentes,
  totalPorMoneda, avisoAFinanzas, type CreditoResumen,
} from './credito-visible'

const scj = (extra: Partial<CreditoResumen> = {}): CreditoResumen => ({
  id: 'c1', status: 'active', monto: 5000, currency: 'CRC', vence: '2027-10-08',
  motivo: 'Theos cerró el grupo', origen: 'Sirviendo como Jesús', origin_payment_id: 'p1', ...extra,
})

describe('estado del crédito', () => {
  it('active con fecha futura es vigente; con fecha pasada, vencido', () => {
    expect(estadoDelCredito(scj(), '2026-10-27')).toBe('vigente')
    expect(estadoDelCredito(scj(), '2027-10-09')).toBe('vencido')
    // El mismo día todavía vale.
    expect(estadoDelCredito(scj(), '2027-10-08')).toBe('vigente')
  })

  it('used y revoked mandan sobre la fecha', () => {
    expect(estadoDelCredito(scj({ status: 'used' }), '2028-01-01')).toBe('usado')
    expect(estadoDelCredito(scj({ status: 'revoked' }), '2026-01-01')).toBe('revocado')
  })

  it('sin vencimiento nunca vence', () => {
    expect(estadoDelCredito(scj({ vence: null }), '2099-01-01')).toBe('vigente')
  })
})

describe('la etiqueta sobre el pago', () => {
  it('dice que se congeló, cuánto quedó a favor y hasta cuándo, en fecha tica', () => {
    expect(etiquetaCongelado(scj(), '2026-10-27')).toBe('Congelado → crédito a favor de ₡5.000 (vence 08/10/2027)')
  })

  it('cuando ya se usó o venció, lo dice en vez de prometer plata', () => {
    expect(etiquetaCongelado(scj({ status: 'used' }), '2026-10-27')).toContain('ya usado')
    expect(etiquetaCongelado(scj(), '2027-12-01')).toContain('vencido el 08/10/2027')
    expect(etiquetaCongelado(scj({ status: 'revoked' }), '2026-10-27')).toContain('revocado')
  })
})

describe('la línea del perfil', () => {
  it('monto, origen y vencimiento', () => {
    expect(lineaDeCreditoEnPerfil(scj()))
      .toBe('Crédito a favor: ₡5.000 (origen: Sirviendo como Jesús, matrícula congelada) · vence 08/10/2027')
  })

  it('sin estudio conocido igual dice que fue un congelamiento', () => {
    expect(lineaDeCreditoEnPerfil(scj({ origen: null, vence: null })))
      .toBe('Crédito a favor: ₡5.000 (matrícula congelada)')
  })

  it('solo los vigentes cuentan como plata a favor, de mayor a menor', () => {
    const lista = [scj({ id: 'a', monto: 5000 }), scj({ id: 'b', status: 'used', monto: 25000 }), scj({ id: 'c', monto: 15000 })]
    expect(creditosVigentes(lista, '2026-10-27').map(c => c.id)).toEqual(['c', 'a'])
  })

  it('el total va por moneda', () => {
    expect(totalPorMoneda([scj({ monto: 5000 }), scj({ monto: 15000 }), scj({ currency: 'USD', monto: 20 })]))
      .toEqual([{ currency: 'CRC', total: 20000 }, { currency: 'USD', total: 20 }])
  })
})

describe('el aviso a finanzas', () => {
  it('dice quién, a quién, cuánto y por qué', () => {
    const a = avisoAFinanzas({ member_name: 'Raquel Ulate', monto: 5000, currency: 'CRC', estudio: 'Sirviendo como Jesús', motivo: 'Theos cerró el grupo', quien: 'Ari' })
    expect(a.title).toBe('Matrícula congelada: Raquel Ulate')
    expect(a.body).toBe('Ari le congeló Sirviendo como Jesús y quedó un crédito de ₡5.000 a su favor. Motivo: Theos cerró el grupo')
  })
})
