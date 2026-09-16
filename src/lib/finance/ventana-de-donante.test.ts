import { describe, it, expect } from 'vitest'
import {
  inicioDeLaVentana, mesDeLaVentana, subtituloDeDonantes, explicacionDeDonantes,
} from './ventana-de-donante'

describe('ventana de donante activo', () => {
  it('cuenta el mes actual como uno de los seis', () => {
    // 16-set-2026: set, ago, jul, jun, may, abr. Arranca el 1 de abril, que es
    // la fecha con la que la base calculó los 614.
    expect(inicioDeLaVentana(new Date('2026-09-16T23:27:00Z'))).toBe('2026-04-01')
    expect(mesDeLaVentana(new Date('2026-09-16T23:27:00Z'))).toBe('abril de 2026')
  })

  it('cruza bien el cambio de año', () => {
    expect(inicioDeLaVentana(new Date('2027-02-10T12:00:00Z'))).toBe('2026-09-01')
    expect(mesDeLaVentana(new Date('2027-01-05T12:00:00Z'))).toBe('agosto de 2026')
  })

  it('el primer día del mes ya cuenta el mes nuevo', () => {
    expect(inicioDeLaVentana(new Date('2026-10-01T00:00:00Z'))).toBe('2026-05-01')
  })

  it('el último instante del mes todavía es el mes viejo', () => {
    expect(inicioDeLaVentana(new Date('2026-09-30T23:59:59Z'))).toBe('2026-04-01')
  })

  it('SE CALCULA EN UTC, igual que la base', () => {
    // 30-set 20:00 en Costa Rica son las 02:00 del 1-oct en UTC. La base ya
    // movió su ventana a mayo; si acá usáramos la fecha de Costa Rica diríamos
    // abril y el texto contradiría al número durante seis horas cada mes.
    const seisPmEnCostaRica = new Date('2026-10-01T02:00:00Z')
    expect(inicioDeLaVentana(seisPmEnCostaRica)).toBe('2026-05-01')
  })

  it('el subtítulo entra en la tarjeta, como los otros', () => {
    // Los vecinos son "Niveles N1–N4" y "Resto de grupos".
    const s = subtituloDeDonantes(new Date('2026-09-16T12:00:00Z'))
    expect(s).toBe('Donaron desde abril de 2026')
    expect(s.length).toBeLessThan(40)
  })

  it('la explicación larga dice la regla completa', () => {
    expect(explicacionDeDonantes(new Date('2026-09-16T12:00:00Z')))
      .toBe('Donaron al menos una vez desde abril de 2026: los últimos 6 meses, contando el actual.')
  })

  it('setiembre se escribe como en Costa Rica', () => {
    // 'septiembre' con p es lo que devuelve toLocaleDateString; acá se escribe
    // sin ella.
    expect(mesDeLaVentana(new Date('2027-02-10T12:00:00Z'))).toContain('setiembre')
  })
})
