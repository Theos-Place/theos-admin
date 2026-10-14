import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * DIR-8 · La ficha del dirigente se guarda por `member_id`, y si no toca
 * nada NO dice «guardado».
 *
 * EL BUG (12 al 13 de octubre de 2026). El endpoint hacía:
 *
 *     .update(cambios).eq('id', id)
 *
 * pero el `[id]` de la ruta es el del MIEMBRO, y `study_leaders` tiene su
 * propia PK. Los dos son UUID válidos y distintos, así que el update no
 * encontraba fila, NO daba error y devolvía 200 OK. Resultado: todo lo que
 * se editaba en la ficha administrativa —estado, razón, banderita, notas—
 * se perdía en silencio mientras la pantalla decía que había guardado.
 *
 * Estuvo así un día entero sin que nadie lo notara, porque un guardado que
 * falla con 200 es invisible: no hay error que ver. Se descubrió de
 * casualidad, al agregar un campo nuevo y ver que tampoco persistía.
 *
 * POR ESO EL GUARD TIENE DOS MITADES. La clave correcta evita el bug; el
 * `count === 0` hace que la próxima variante del mismo error sea RUIDOSA en
 * vez de silenciosa.
 */
const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const API = sinComentarios('src/app/api/studies/dirigentes/[id]/estado/route.ts')

describe('guardar el estado del dirigente', () => {
  it('busca la fila por member_id, no por la PK', () => {
    expect(API).toContain(".eq('member_id', id)")
  })

  it('y NO por `id`, que es lo que estaba mal', () => {
    expect(API).not.toMatch(/\.update\([^)]*\)\s*\.eq\(\s*['"]id['"]/)
  })

  it('si no tocó ninguna fila, responde 404 en vez de «ok»', () => {
    // La mitad que convierte el próximo error de este tipo en algo visible.
    expect(API).toContain("count: 'exact'")
    expect(API).toMatch(/if \(count === 0\)[\s\S]{0,200}status: 404/)
  })
})
