/**
 * Un pago que nace «pagado» lleva fecha de pago.
 *
 * El 2026-10-14 había 124 pagos cancelados por comprobante que la lista de
 * finanzas mostraba «sin fecha de pago». Nacieron por el camino del
 * 2026-10-07 (formulario que exige comprobante) y ese INSERT no escribía
 * `paid_at`; `approve_payment` sí lo hace, pero este camino no pasa por ahí.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { descripcionDeEvento } from '@/lib/finance/descripcion-de-evento'

const src = readFileSync('src/lib/supabase/queries/forms.ts', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('el pago que nace pagado', () => {
  it('escribe paid_at en el INSERT', () => {
    const i = src.indexOf('async function crearPagoDeLaInscripcion')
    const cuerpo = src.slice(i, i + 2500)
    expect(cuerpo).toContain('paid_at: input.fechaDeRespuesta ?? new Date().toISOString()')
  })

  it('y la fecha es la de la respuesta, que es cuándo adjuntó el comprobante', () => {
    expect(src).toMatch(/crearPagoDeLaInscripcion\(supabase, \{[\s\S]{0,200}fechaDeRespuesta,/)
  })
})

describe('las filas de evento dicen la fecha de la sesión', () => {
  it('título y día', () => {
    expect(descripcionDeEvento({ title: 'Volley', starts_at: '2026-10-18T22:00:00+00:00' })).toBe('Volley · 18 oct 2026')
  })

  it('sin fecha, solo el título', () => {
    expect(descripcionDeEvento({ title: 'Volley ', starts_at: null })).toBe('Volley')
  })

  it('sin evento, nada', () => {
    expect(descripcionDeEvento(null)).toBeNull()
  })

  it('no usa Date: el día sale del string, sin zona horaria', () => {
    // `new Date('2026-10-18T00:30:00Z')` en Costa Rica es el 17.
    expect(descripcionDeEvento({ title: 'X', starts_at: '2026-10-18T00:30:00Z' })).toBe('X · 18 oct 2026')
  })
})
