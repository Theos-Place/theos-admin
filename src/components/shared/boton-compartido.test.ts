import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * QA-1/N3 · Trinquete: los botones escritos a mano solo pueden BAJAR.
 *
 * Este test no exige que no quede ninguno —quedan 188 y migrarlos a ciegas es
 * peor que dejarlos, porque casi todos están en pantallas con sesión que no se
 * pueden mirar sin cuentas de prueba—. Lo que hace es poner un techo, igual que
 * `--max-warnings` en el linter: una pantalla nueva que escriba las clases a
 * mano rompe el test, y cada tanda que migre baja el número.
 *
 * Si este número sube, la respuesta no es subir el techo: es usar
 * `components/shared/Button`.
 */
const TECHO = 188

const TSX = (dir: string): string[] =>
  readdirSync(dir).flatMap(n => {
    const ruta = join(dir, n)
    if (statSync(ruta).isDirectory()) return TSX(ruta)
    return n.endsWith('.tsx') ? [ruta] : []
  })

// Un elemento clicable con fondo de marca puesto a mano. `Button.tsx` queda
// fuera: es el que tiene permiso.
const CLICABLE = /<(button|Link|a)\b(?:[^<>]|\n)*?>/g
const MARCA = /(?<![\w-])(bg-coral-deep|bg-coral|bg-navy)(?![\w/-])/

function aMano(): string[] {
  const encontrados: string[] = []
  for (const ruta of TSX('src')) {
    if (ruta.endsWith('shared/Button.tsx')) continue
    const src = readFileSync(ruta, 'utf8')
    for (const m of src.matchAll(CLICABLE)) {
      if (MARCA.test(m[0])) {
        encontrados.push(`${ruta}:${src.slice(0, m.index).split('\n').length}`)
      }
    }
  }
  return encontrados
}

describe('el botón compartido', () => {
  it(`no hay más de ${TECHO} botones con las clases escritas a mano`, () => {
    const hallados = aMano()
    // El mensaje lista los primeros para que el que rompe el test sepa cuál es
    // el suyo sin tener que volver a correr el grep.
    expect(
      hallados.length,
      hallados.length > TECHO
        ? `Subió a ${hallados.length}. Usá <Button> en vez de las clases sueltas.\n` +
          hallados.slice(-5).join('\n')
        : '',
    ).toBeLessThanOrEqual(TECHO)
  })

  it('cuando baje, hay que bajar el techo — si no, el trinquete no aprieta', () => {
    const hallados = aMano()
    expect(
      TECHO - hallados.length,
      `Quedan ${hallados.length} y el techo está en ${TECHO}: bajalo a ${hallados.length}.`,
    ).toBeLessThanOrEqual(0)
  })

  it('las pantallas de acceso y las públicas ya no tienen ninguno', () => {
    // Es la parte que se migró con el navegador abierto, o sea la única que se
    // pudo comprobar de verdad. Que no retroceda.
    expect(aMano().filter(r => r.includes('(auth)') || r.includes('(public)'))).toEqual([])
  })
})
