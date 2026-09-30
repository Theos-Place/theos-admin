import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { leFaltaAlgo, faltantes, type Compromisos } from './compromisos'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const c = (over: Partial<Compromisos>): Compromisos => ({
  asistencia: true, llevandoEstudio: true, dandoEstudio: false, donante: true,
  ultimoCheckin: null, ...over,
})

/**
 * SRV-16 parte 3 · REVIERTE SRV-10.
 *
 * SRV-10 (dirección, 2026-09-24) le recortaba al líder de comité el dato de
 * donante —la columna, el KPI, el filtro y el export— mientras se definía cómo
 * se usaba. Ya se definió (Floriana, 2026-09-30): el líder lo ve.
 *
 * Este archivo reemplaza a `visibilidad-de-donante.test.ts`, que afirmaba lo
 * contrario. Se invierte en vez de borrarse porque el recorte volvió a la UI
 * dos veces mientras estuvo vigente, y ahora lo que hay que cuidar es lo
 * simétrico: que el dato NO se quede afuera por un resto del código viejo.
 */
describe('el dato de donante llega a todo el que abre la pantalla', () => {
  it('el endpoint ya no recorta nada', () => {
    const s = sinComentarios('src/app/api/servers/mi-comite/route.ts')
    expect(s).not.toContain('recortarDonante')
    expect(s).not.toContain('puedeVerDonante')
    expect(s).not.toContain('verDonante')
  })

  it('el módulo del recorte se fue entero', () => {
    // Quedarse con una función que siempre devuelve `true` es peor que no
    // tenerla: parece una compuerta y no lo es.
    expect(() => readFileSync('src/lib/servers/visibilidad-de-donante.ts', 'utf8')).toThrow()
  })

  it('la pantalla dibuja la columna sin preguntarle nada al servidor', () => {
    const s = sinComentarios('src/app/(admin)/servidores/mi-comite/page.tsx')
    expect(s).not.toContain('verDonante')
    expect(s).toContain("{ label: 'Donante'")
    expect(s).toContain("titulo=\"Donante activo\"")
  })

  it('y vuelve al archivo que se baja', () => {
    const s = sinComentarios('src/app/(admin)/servidores/mi-comite/page.tsx')
    expect(s).toContain("label: 'Donante activo'")
    // El filtro que la sacaba del export era la otra mitad del recorte.
    expect(s).not.toContain("c.key !== 'donante'")
  })
})

describe('«le falta» vuelve a decir «donación»', () => {
  it('quien no dona tiene esa falta', () => {
    expect(leFaltaAlgo(c({ donante: false }))).toBe(true)
    expect(faltantes(c({ donante: false }))).toContain('donación')
  })

  it('quien dona no', () => {
    expect(leFaltaAlgo(c({}))).toBe(false)
    expect(faltantes(c({}))).toEqual([])
  })

  it('las otras dos faltas siguen igual', () => {
    expect(faltantes(c({ asistencia: false }))).toEqual(['asistencia'])
    expect(faltantes(c({ llevandoEstudio: false, dandoEstudio: false }))).toEqual(['estudio'])
    expect(faltantes(c({ llevandoEstudio: false, dandoEstudio: true }))).toEqual([])
  })

  it('el campo es OBLIGATORIO otra vez', () => {
    // Mientras fue opcional, `undefined` significaba «no me toca verlo» y la
    // regla lo saltaba. Si volviera a ser opcional, un dato que no llegó por
    // error se leería como «no cuenta» en vez de como «no dona».
    const tipo = readFileSync('src/lib/servers/compromisos.ts', 'utf8')
    expect(tipo).toContain('donante: boolean')
    expect(tipo).not.toContain('donante?: boolean')
  })
})
