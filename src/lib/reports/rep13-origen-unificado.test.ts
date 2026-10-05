import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  origenUnificado, origenesDeCharla, filtrarSerie, type FilaDeSerie,
} from '@/lib/reports/personas-nuevas'
import { sedeFromTitle } from '@/lib/reports/charla-attendance'

const fila = (origen: string | null, n: number, canal = 'charla'): FilaDeSerie =>
  ({ anio: 2026, mes: 9, canal, origen, n })

describe('REP-13 · el origen se unifica como en asistencia', () => {
  it('el caso reportado: United y Pedregal Domingo son la misma charla', () => {
    // Se renombraron en bloque entre el 9 y el 13 de setiembre de 2026.
    expect(origenUnificado('charla', 'Charla United')).toBe('Pedregal Domingo')
    expect(origenUnificado('charla', 'Charla Pedregal Domingo')).toBe('Pedregal Domingo')
  })

  it('y los otros ocho pares del renombre también', () => {
    const pares: Array<[string, string]> = [
      ['Charla Heredia', 'Charla Pedregal Miércoles'],
      ['Charla Meridiano', 'Charla Meridiano Martes'],
      ['Charla Antares', 'Charla Antares Miércoles'],
      ['Charla Cartago', 'Charla Cartago Miércoles'],
      ['Charla Liberia', 'Charla Liberia Miércoles'],
      ['Charla Madrid', 'Charla Madrid Domingo'],
      ['Charla Alajuela', 'Charla Alajuela Jueves'],
      ['Charla Potrero', 'Charla Potrero Jueves'],
      ['Charla Pérez Zeledón', 'Charla Pérez Zeledón Miércoles'],
    ]
    for (const [viejo, nuevo] of pares) {
      expect(origenUnificado('charla', viejo), `${viejo} vs ${nuevo}`)
        .toBe(origenUnificado('charla', nuevo))
    }
  })

  it('una charla sin equivalencia pasa igual', () => {
    // «United Este» fue una sede real que cerró en 2024: no es alias de nada.
    expect(origenUnificado('charla', 'United Este')).toBe('United Este')
  })

  it('NO toca los estudios: ahí el origen es el nombre del plan', () => {
    // Pasarlos por un diccionario de sedes no los cambia hoy, pero ataría el
    // nombre de un estudio a una tabla de charlas y el día que un alias
    // colisione el error sería silencioso.
    for (const plan of ['Nivel 1', 'Discípulos 2', 'Panorama', 'Charla Antares']) {
      expect(origenUnificado('estudio', plan)).toBe(plan)
    }
  })

  it('ni los eventos', () => {
    expect(origenUnificado('evento', 'Charla Antares')).toBe('Charla Antares')
  })

  it('un origen vacío no se inventa', () => {
    expect(origenUnificado('charla', null)).toBeNull()
    expect(origenUnificado('charla', '')).toBe('')
  })

  it('usa la MISMA función que el reporte de asistencia, no un mapa propio', () => {
    // Dos mapas es divergencia garantizada.
    expect(origenUnificado('charla', 'Charla Heredia')).toBe(sedeFromTitle('Charla Heredia'))
    const src = readFileSync('src/lib/reports/personas-nuevas.ts', 'utf8')
    expect(src).toContain("import { sedeFromTitle } from '@/lib/reports/charla-attendance'")
  })
})

describe('REP-13 · el efecto en el reporte', () => {
  // Las cifras son las de producción, medidas el 2026-10-05.
  const serie = [
    fila('Charla United', 1292), fila('Charla Pedregal Domingo', 33),
    fila('Charla Heredia', 900), fila('Charla Pedregal Miércoles', 20),
    fila('United Este', 50),
    fila('Nivel 1', 300, 'estudio'),
  ]
  const unificada = serie.map(f => ({ ...f, origen: origenUnificado(f.canal, f.origen) }))

  it('el selector deja de mostrar la charla dos veces', () => {
    expect(origenesDeCharla(serie)).toHaveLength(5)
    expect(origenesDeCharla(unificada)).toHaveLength(3)
    expect(origenesDeCharla(unificada)).toEqual(
      ['Pedregal Domingo', 'Pedregal Miércoles', 'United Este'])
  })

  it('y los números se SUMAN, no se pierde una de las dos', () => {
    const total = (o: string) =>
      filtrarSerie(unificada, { origen: o, canal: 'charla' }).reduce((a, f) => a + f.n, 0)
    expect(total('Pedregal Domingo')).toBe(1325)
    expect(total('Pedregal Miércoles')).toBe(920)
  })

  it('el total general NO cambia: no se pierde ni se inventa nadie', () => {
    // Es la invariante que importa. Verificado también contra producción:
    // 14 832 personas nuevas antes y después.
    const suma = (fs: FilaDeSerie[]) => fs.reduce((a, f) => a + f.n, 0)
    expect(suma(unificada)).toBe(suma(serie))
  })

  it('el estudio sigue contándose aparte', () => {
    expect(filtrarSerie(unificada, { canal: 'estudio' }).reduce((a, f) => a + f.n, 0)).toBe(300)
  })
})

describe('REP-13 · se aplica en el borde de la consulta', () => {
  const sinComentarios = (ruta: string): string =>
    readFileSync(ruta, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
  const QUERY = 'src/lib/supabase/queries/reports.ts'

  it('la SERIE sale unificada', () => {
    // Acá y no en cada pantalla: así el filtro, el selector, los dos gráficos
    // y la tabla ven el mismo nombre sin acordarse de aplicarlo.
    expect(sinComentarios(QUERY))
      .toMatch(/origen: origenUnificado\(f\.canal, f\.origen\)/)
  })

  it('y el DETALLE también, con el mismo nombre', () => {
    // Si la tabla dijera «Charla United» y el gráfico «Pedregal Domingo»,
    // filtrar por uno vaciaría el otro.
    const src = sinComentarios(QUERY)
    const i = src.indexOf('export async function getPersonasNuevas')
    expect(src.slice(i)).toContain('origenUnificado(')
  })
})
