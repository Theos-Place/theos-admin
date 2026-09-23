import { describe, it, expect } from 'vitest'
import { calcularAntiguedad } from './columns'

/**
 * El «NaN año» que salía en la lista del Comité Dirigentes (reportado el
 * 2026-09-23). La causa no era el cálculo sino el TIPO: la función pedía
 * `string`, la base tiene 46 servidores con `start_date` nulo, y el tipo de la
 * fila también mentía — así que TypeScript dejaba pasar el null hasta acá.
 *
 * Estos casos fijan que ninguna entrada rara llegue a la pantalla como texto
 * roto. Todas caen en '—', que es como el resto del sistema dice «no hay dato».
 */
describe('calcularAntiguedad', () => {
  it('sin fecha da la raya, NUNCA NaN', () => {
    for (const v of [null, undefined, '', '   ']) {
      const r = calcularAntiguedad(v as string | null | undefined)
      expect(r, String(v)).toBe('—')
      expect(r).not.toContain('NaN')
    }
  })

  it('una fecha que no se entiende tampoco rompe', () => {
    for (const v of ['no es fecha', '2026-13-45', 'ayer', '//', '0000']) {
      expect(calcularAntiguedad(v), v).toBe('—')
    }
  })

  it('una fecha FUTURA no devuelve meses negativos', () => {
    const mañana = new Date(Date.now() + 400 * 86400000).toISOString().slice(0, 10)
    expect(calcularAntiguedad(mañana)).toBe('—')
  })

  it('cuenta meses y años en singular y plural', () => {
    const hace = (meses: number) => {
      const d = new Date()
      d.setMonth(d.getMonth() - meses)
      return d.toISOString().slice(0, 10)
    }
    expect(calcularAntiguedad(hace(0))).toBe('0 meses')
    expect(calcularAntiguedad(hace(1))).toBe('1 mes')
    expect(calcularAntiguedad(hace(5))).toBe('5 meses')
    expect(calcularAntiguedad(hace(12))).toBe('1 año')
    expect(calcularAntiguedad(hace(25))).toBe('2 años, 1 mes')
  })

  it('NINGUNA entrada produce un texto con NaN', () => {
    const entradas = [null, undefined, '', 'x', '2026-02-30', '2026', '2026-09-23', '1900-01-01']
    for (const v of entradas) {
      expect(calcularAntiguedad(v as string | null | undefined), String(v)).not.toMatch(/NaN|Invalid|undefined/)
    }
  })
})
