import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * EL CAMINO COMPLETO de la asistencia por participante, no sus dos puntas.
 *
 * Esta prueba existe por lo que pasó con EST-26 el 2026-10-07: la consulta
 * devolvía `ofrece_casa`, la pantalla sabía pintarlo, las dos puntas tenían
 * test… y la columna salía vacía, porque el ADAPTADOR del medio botaba el
 * campo. Nadie miraba el medio.
 *
 * Acá el medio es: la consulta manda `member_id` en cada marca, el endpoint
 * devuelve `{ sesiones, marcas }` y la pantalla lee las dos cosas. Si una de
 * las tres se mueve sola, la tabla se queda sin datos sin romperse.
 */
const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const QUERIES = 'src/lib/supabase/queries/studies.ts'
const PAGINA = 'src/app/(admin)/estudios/grupos/[id]/page.tsx'
const ENDPOINT = 'src/app/api/studies/groups/[id]/sessions/route.ts'

describe('asistencia por participante · el cableado', () => {
  it('la consulta pide member_id, sin eso no hay nada que mostrar', () => {
    const fn = sinComentarios(QUERIES)
    const cuerpo = fn.slice(fn.indexOf('export async function getGroupSessions'))
    expect(cuerpo).toContain('study_attendance(member_id, present)')
  })

  it('y devuelve las marcas CRUDAS: sin fila ≠ ausente', () => {
    /**
     * Si acá se rellenara con `present: false` quien no tiene fila, la
     * persona que entró en la sesión 4 aparecería con tres faltas que nadie
     * le puso. La diferencia se pierde en la consulta y ya no se recupera.
     */
    const fn = sinComentarios(QUERIES)
    const cuerpo = fn.slice(fn.indexOf('export async function getGroupSessions'))
    expect(cuerpo).toContain('marcas:')
    expect(cuerpo).not.toMatch(/present:\s*false/)
  })

  it('la pantalla lee las DOS mitades de la respuesta', () => {
    // Leer solo `sesiones` dejaría la tabla con todas las celdas en «sin
    // registro» — vacía, pero sin error que lo delate.
    const src = sinComentarios(PAGINA)
    expect(src).toContain('d?.sesiones')
    expect(src).toContain('d?.marcas')
  })

  it('la tabla sale de `matrizDeAsistencia`, no de una cuenta escrita ahí', () => {
    // Las tres reglas (sin_registro, porcentaje sobre lo registrado, a quién
    // llamar) viven en un módulo con pruebas. Recalcularlas en la pantalla es
    // tener la misma regla en dos lugares.
    const src = sinComentarios(PAGINA)
    expect(src).toContain('matrizDeAsistencia({')
    expect(src).toContain('hayQueLlamar(')
  })

  it('el permiso NO se aflojó: sigue el mismo guard de siempre', () => {
    // La vista nueva muestra MÁS (quién faltó, no solo cuántos), así que es
    // justo acá donde un descuido se volvería una fuga.
    const src = sinComentarios(ENDPOINT)
    expect(src).toContain('groupViewerScope')
    expect(src).toContain("scope === 'none'")
    expect(src).toContain('status: 403')
  })

  it('cada celda dice su estado en texto, no solo en color', () => {
    // Un verde y un rojo no se distinguen con daltonismo ni se leen en voz
    // alta. Va la letra visible y el nombre completo para el lector.
    const src = sinComentarios(PAGINA)
    expect(src).toContain('ETIQUETA_DE_CELDA[c]')
    expect(src).toContain('<span className="sr-only">{ETIQUETA_DE_CELDA[c]}</span>')
  })
})
