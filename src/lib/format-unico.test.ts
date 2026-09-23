import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * QA-1/N1 · Trinquete: el formato de fechas y horas se concentra en `lib/format`.
 *
 * LA CUENTA DEL INFORME ESTABA MEZCLADA. Decía «208 llamadas a `toLocale*`, cada
 * una una oportunidad de repetir C1». Al separarlas:
 *
 *   119  toLocaleString SIN opciones → son NÚMEROS (separador de miles).
 *        No tienen nada que ver con zonas horarias. Para eso está `formatNumber`,
 *        pero no son un riesgo y no los cuenta este test.
 *    64  toLocaleDateString, en 29 formas distintas — de las cuales 22 eran
 *        copias EXACTAS de `formatDate` y `formatDateLong`, que ya existían.
 *    16  toLocaleTimeString, en 6 formas… y `lib/format` NO TENÍA formateador
 *        de hora. Cuando el helper falta, cada pantalla se lo inventa: esa es
 *        la causa raíz, no la desidia.
 *
 * Quedan las que hacen algo que ningún helper cubre todavía: zona horaria
 * explícita, días de la semana, formatos de un solo uso. Bajan por tandas.
 *
 * Si este número sube, la respuesta no es subir el techo: es agregar el helper
 * que falta en `lib/format` y usarlo.
 */
const TECHO = 59

const RX = /\.(toLocaleDateString|toLocaleTimeString)\(/g

const fuentes = (dir: string): string[] =>
  readdirSync(dir).flatMap(n => {
    const ruta = join(dir, n)
    if (statSync(ruta).isDirectory()) return fuentes(ruta)
    return /\.tsx?$/.test(n) ? [ruta] : []
  })

function sueltas(): string[] {
  const out: string[] = []
  for (const ruta of fuentes('src')) {
    // `lib/format` es justamente donde deben vivir.
    if (ruta.startsWith(join('src', 'lib', 'format'))) continue
    const src = readFileSync(ruta, 'utf8')
    for (const m of src.matchAll(RX)) {
      out.push(`${ruta}:${src.slice(0, m.index).split('\n').length}`)
    }
  }
  return out
}

describe('formato de fechas y horas', () => {
  it(`no hay más de ${TECHO} llamadas sueltas`, () => {
    const h = sueltas()
    expect(
      h.length,
      h.length > TECHO
        ? `Subió a ${h.length}. Si ningún helper de lib/format sirve, agregá el que falta.\n` +
          h.slice(-5).join('\n')
        : '',
    ).toBeLessThanOrEqual(TECHO)
  })

  it('cuando baje, hay que bajar el techo', () => {
    const h = sueltas()
    expect(TECHO - h.length, `Quedan ${h.length}: bajá el techo a ${h.length}.`).toBeLessThanOrEqual(0)
  })
})
