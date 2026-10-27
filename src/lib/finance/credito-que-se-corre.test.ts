/**
 * FIN-9c · Un crédito que llega al cierre de su bloque sin usarse NO se
 * pierde: se corre al bloque siguiente (Floriana, 2026-10-27).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  tocaCorrerElCredito, vencimientoDelCredito, cuerpoDelCorrimiento, avisoDeCorrimiento,
  TIPO_CREDITO_CORRIDO,
} from './credito-por-congelar'
import { diaEnCostaRica } from './credito-visible'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('cuándo se corre', () => {
  it('un activo cuyo cierre ya PASÓ', () => {
    expect(tocaCorrerElCredito({ status: 'active', vence: '2027-01-22' }, '2027-01-23')).toBe(true)
  })

  it('el mismo día del cierre todavía vale: no se corre', () => {
    // Ese día todavía se puede matricular; correrlo antes mentiría la fecha.
    expect(tocaCorrerElCredito({ status: 'active', vence: '2027-01-22' }, '2027-01-22')).toBe(false)
    expect(tocaCorrerElCredito({ status: 'active', vence: '2027-01-22' }, '2026-10-27')).toBe(false)
  })

  it('un usado o revocado se queda como está, y sin fecha no hay nada que correr', () => {
    expect(tocaCorrerElCredito({ status: 'used', vence: '2027-01-22' }, '2027-02-01')).toBe(false)
    expect(tocaCorrerElCredito({ status: 'revoked', vence: '2027-01-22' }, '2027-02-01')).toBe(false)
    expect(tocaCorrerElCredito({ status: 'active', vence: null }, '2027-02-01')).toBe(false)
  })

  it('acepta la fecha con hora: lo que importa es el día', () => {
    expect(tocaCorrerElCredito({ status: 'active', vence: '2027-01-22T23:59:59.999-06:00' }, '2027-01-23')).toBe(true)
  })
})

describe('a dónde se corre', () => {
  it('al cierre de matrícula del bloque siguiente, con la MISMA regla del nacimiento', () => {
    // Los seis créditos de hoy vencen con Bloque 1 2027 (22/01/2027). Si al
    // día siguiente siguen activos, pasan a Bloque 2 2027.
    expect(vencimientoDelCredito({ fechaDeCierreDelBloqueSiguiente: '2027-05-22', hoy: '2027-01-23' })).toBe('2027-05-22')
  })

  it('sin bloque siguiente cargado, un año más: tarde antes que perdido', () => {
    expect(vencimientoDelCredito({ fechaDeCierreDelBloqueSiguiente: null, hoy: '2027-01-23' })).toBe('2028-01-23')
  })
})

describe('lo que leen', () => {
  it('la persona: que no perdió nada y hasta cuándo', () => {
    expect(cuerpoDelCorrimiento({ monto: '₡5.000', vence: '22/05/2027' }))
      .toBe('No usaste los ₡5.000 que te guardamos, así que los seguimos guardando para el siguiente bloque: los podés usar hasta el 22/05/2027. No tenés que hacer nada.')
    expect(TIPO_CREDITO_CORRIDO).toBe('credito_corrido')
  })

  it('finanzas: quién, cuánto, de qué fecha a cuál', () => {
    const a = avisoDeCorrimiento({ member_name: 'Raquel Ulate', monto: '₡5.000', venciaEl: '22/01/2027', venceAhora: '22/05/2027' })
    expect(a.title).toBe('Crédito corrido al siguiente bloque: Raquel Ulate')
    expect(a.body).toBe('Su crédito de ₡5.000 llegó al 22/01/2027 sin usarse y se corrió: ahora vence el 22/05/2027.')
  })
})

describe('el cableado', () => {
  it('corre en el barrido diario de pagos, no en un cron nuevo', () => {
    const r = sinComentarios('src/app/api/cron/payment-holds-expire/route.ts')
    expect(r).toContain('correrCreditosSinUsar()')
    expect(r).toContain("correrCreditosSinUsar(undefined, { dryRun: true })")
    expect(r).toContain('creditos_corridos')
  })

  it('solo toca ACTIVOS, decide con la regla pura y deja rastro', () => {
    const q = sinComentarios('src/lib/supabase/queries/creditos.ts')
    expect(q).toMatch(/correrCreditosSinUsar[\s\S]{0,600}\.eq\('kind', 'credito'\)\.eq\('status', 'active'\)/)
    expect(q).toContain('if (!tocaCorrerElCredito(c, dia) || !c.vence) continue')
    expect(q).toContain(".eq('id', c.id).eq('status', 'active')")
    expect(q).toContain("op: 'credito_corrido_al_bloque_siguiente'")
    expect(q).toContain('TIPO_CREDITO_CORRIDO')
  })
})

describe('la fecha que se muestra es el día en Costa Rica', () => {
  it('las 23:59 de Costa Rica son el día siguiente en UTC: no se recorta el ISO', () => {
    // Antes del 2026-10-27 el resumen hacía expires_at.slice(0, 10) y un
    // crédito que vence el 22/01 salía como «vence 23/01».
    expect(diaEnCostaRica('2027-01-23T05:59:59.999+00:00')).toBe('2027-01-22')
    expect(diaEnCostaRica('2027-01-22T23:59:59.999-06:00')).toBe('2027-01-22')
    expect(diaEnCostaRica(null)).toBeNull()
    const q = sinComentarios('src/lib/supabase/queries/creditos.ts')
    expect(q).not.toContain('expires_at.slice(0, 10)')
  })
})
