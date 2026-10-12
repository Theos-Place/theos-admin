import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * EST-26 · Un `.in()` con el roster entero arma una URL que PostgREST
 * rechaza con 400.
 *
 * Pasó de verdad: `ofrecimientosDeCasa` recibía 831 miembros desde el export
 * de participantes, la consulta devolvía Bad Request, el error no se miraba
 * y la columna «Ofrece casa» salía vacía para TODOS. Se veía como «nadie
 * ofreció su casa», que es la peor forma de fallar: creíble.
 *
 * Dos condiciones, y las dos hacen falta: trocear (para que no pase) y
 * mirar el error (para que, si vuelve a pasar, se note).
 */
const fuente = readFileSync(join(process.cwd(), 'src/lib/supabase/queries/studies.ts'), 'utf8')

function cuerpoDe(nombre: string): string {
  const i = fuente.indexOf(`export async function ${nombre}(`)
  expect(i, `no existe ${nombre}()`).toBeGreaterThan(-1)
  const sig = fuente.indexOf('\nexport ', i + 1)
  return fuente.slice(i, sig === -1 ? fuente.length : sig)
}

describe('ofrecimientosDeCasa() con un roster grande', () => {
  const cuerpo = cuerpoDe('ofrecimientosDeCasa')

  it('trocea memberIds en vez de mandarlos todos de un solo', () => {
    expect(cuerpo).toMatch(/memberIds\.slice\(/)
    expect(cuerpo).not.toMatch(/\.in\(\s*'respuesta\.member_id',\s*memberIds as string\[\]\s*\)/)
  })

  it('revienta si la consulta falla, en lugar de devolver un mapa vacío', () => {
    expect(cuerpo).toMatch(/if \(error\) throw new Error/)
  })

  it('pagina form_fields: el tope de 1000 de PostgREST no avisa', () => {
    expect(cuerpo).toMatch(/\.range\(/)
  })
})
