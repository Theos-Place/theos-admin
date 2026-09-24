import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const leer = (p: string) => readFileSync(p, 'utf8')

/**
 * SOLO las clases que de verdad se aplican, no las que se mencionan.
 *
 * La primera versión de este test leía el archivo entero y pasaba aunque se
 * borrara la clase: el comentario que explica el arreglo la nombra, y eso
 * alcanzaba para que el `toContain` diera verde. Un guard que no falla cuando
 * se rompe lo que cuida es peor que no tenerlo, porque da confianza. Se
 * descubrió probándolo con un cebo, que es para lo que sirve el cebo.
 */
const clasesAplicadas = (archivo: string): string =>
  [...leer(archivo).matchAll(/className="([^"]*)"/g)].map(m => m[1]).join(' ')

const GLOBO = clasesAplicadas('src/components/shared/InfoDelEncabezado.tsx')
const HEADER = clasesAplicadas('src/components/shared/SortableHeader.tsx')

/**
 * `position: fixed` saca al globo del FLUJO, no de la HERENCIA.
 *
 * El globo se pinta dentro del `<th>`, así que hereda todo lo heredable que el
 * encabezado se ponga encima. El `th` va en versalitas espaciadas y sin cortar
 * el título, y eso al globo lo arruina: con `whitespace-nowrap` heredado, la
 * explicación salía en UNA línea, se iba por el costado y `overflow-auto` la
 * cortaba (reportado el 2026-09-24, después de que un texto largo la hiciera
 * visible por primera vez).
 *
 * Este test recorre las clases HEREDABLES del encabezado y exige que el globo
 * tenga su contraparte. La gracia es que no es una lista de lo que ya pasó: si
 * mañana alguien le agrega otra clase heredable al `th`, el test nombra la que
 * falta en vez de esperar a que se vea feo.
 */
const NEUTRALIZA: Record<string, string> = {
  'whitespace-nowrap': 'whitespace-normal',
  'uppercase': 'normal-case',
  'tracking-widest': 'tracking-normal',
  'tracking-wide': 'tracking-normal',
  'lowercase': 'normal-case',
  'capitalize': 'normal-case',
  'italic': 'not-italic',
}

describe('el globo de ayuda no hereda lo que el encabezado le impone', () => {
  const enElHeader = Object.keys(NEUTRALIZA).filter(c =>
    new RegExp(`(^|\\s)${c.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(\\s|$)`).test(HEADER),
  )

  it('el encabezado sí se pone clases heredables (si no, este test no prueba nada)', () => {
    expect(enElHeader.length).toBeGreaterThan(0)
  })

  for (const clase of enElHeader) {
    it(`neutraliza «${clase}» con «${NEUTRALIZA[clase]}»`, () => {
      expect(GLOBO, `el <th> usa ${clase}; el globo necesita ${NEUTRALIZA[clase]}`)
        .toContain(NEUTRALIZA[clase])
    })
  }

  it('el texto largo puede envolver y romper palabras', () => {
    expect(GLOBO).toContain('break-words')
  })

  it('se mide después de pintarlo, para poder saltar arriba si no cabe', () => {
    // Sin la medición real no hay forma de saber si entra: el alto depende del
    // texto, y el que motivó todo esto son cuatro renglones.
    const fuente = leer('src/components/shared/InfoDelEncabezado.tsx')
    expect(fuente).toContain('useLayoutEffect')
    expect(fuente).toContain('window.innerHeight')
  })
})
