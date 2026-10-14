import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Fusionar con `merge_members()` A SECAS rompe la resolución por
 * external_id.
 *
 * LO QUE PASA. Al fusionar, el external_id del duplicado NO se copia al
 * principal: la ficha del duplicado queda inactiva conservándolo. Para que
 * un import futuro pueda resolver ese ID a la ficha VIVA, hay que anotarlo
 * en `external_id_fusionados` del principal — y eso lo hace
 * `merge_members_resuelto()`, NO `merge_members()`.
 *
 * ME PASÓ EL 2026-10-13. Fusioné las dos fichas de Víctor Guerra con la
 * función cruda. Quedó bien fusionado, pero
 * `member_por_external_id('12649')` siguió devolviendo la ficha MUERTA
 * —peor que no encontrar nada: la persona aparece inactiva cuando está
 * sirviendo—. Hubo que anotar el rastro a mano después.
 *
 * El guard mira `src/`: un script puntual que fusione a mano y sepa lo que
 * hace puede seguir usándola, pero el sistema no.
 */
const EXTENSIONES = ['.ts', '.tsx']

function archivos(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) archivos(p, acc)
    else if (EXTENSIONES.some(x => e.endsWith(x))) acc.push(p)
  }
  return acc
}

describe('las fusiones dejan rastro del external_id', () => {
  it('nadie en src/ llama a `merge_members(` a secas', () => {
    const culpables: string[] = []
    for (const ruta of archivos('src')) {
      // Los tests NOMBRAN la función para probarla; eso no es llamarla.
      if (ruta.includes('.test.')) continue
      readFileSync(ruta, 'utf8').split('\n').forEach((linea, i) => {
        if (linea.trim().startsWith('*') || linea.trim().startsWith('//')) return
        // Solo la LLAMADA por RPC, y solo la cruda: `merge_members_resuelto`
        // es la correcta porque anota el rastro.
        if (/\.rpc\(\s*['"`]merge_members['"`]/.test(linea)) culpables.push(`${ruta}:${i + 1}`)
      })
    }
    expect(culpables, [
      '`merge_members()` no anota el external_id del duplicado en',
      '`external_id_fusionados`, así que después `member_por_external_id()`',
      'devuelve la ficha MUERTA. Usá `merge_members_resuelto()`.',
      ...culpables,
    ].join('\n  ')).toEqual([])
  })
})
