import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * UI-3 · La flecha del `select` va separada del borde, en TODOS.
 *
 * EL PROBLEMA (reportado el 2026-10-13 con una captura): el navegador
 * dibuja su flecha pegada al borde derecho y, con las esquinas redondeadas
 * del sistema, queda montada sobre la curva.
 *
 * LA REGLA ES GLOBAL Y ESO ES LA DECISIÓN. Son 174 `<select>` en 95
 * archivos; envolver cada uno para colgarle una flecha propia habría
 * cambiado el layout de todos los que viven dentro de un flex o un grid
 * —el wrapper no hereda `flex-1` ni `w-32`—. La regla toca el MISMO
 * elemento y no mueve nada de sitio.
 *
 * Este test cuida las tres mitades que, separadas, no sirven: apagar la
 * flecha nativa SIN dibujar una propia deja el control sin ninguna señal de
 * que es un desplegable (ya pasaba en el alta de miembros), y dibujarla sin
 * reservar el espacio la monta sobre el texto.
 */
const CSS = readFileSync('src/app/globals.css', 'utf8')
const bloque = (() => {
  const i = CSS.indexOf('\nselect {')
  return i === -1 ? '' : CSS.slice(i, CSS.indexOf('}', i))
})()

describe('la flecha del select', () => {
  it('apaga la nativa', () => {
    expect(bloque).toContain('appearance: none')
    expect(bloque).toContain('-webkit-appearance: none')
  })

  it('y dibuja una propia: apagarla sin reemplazo deja el control mudo', () => {
    expect(bloque).toContain('background-image')
    expect(bloque).toContain('svg')
  })

  it('separada del borde, que era el reclamo', () => {
    expect(bloque).toMatch(/background-position:\s*right\s+[\d.]+rem/)
  })

  it('con espacio reservado para que no se monte sobre el texto', () => {
    expect(bloque).toMatch(/padding-right:\s*[\d.]+rem/)
  })
})

describe('las listas abiertas quedan afuera', () => {
  it('`multiple` y `size` no llevan flecha ni el padding extra', () => {
    // Muestran una lista, no un desplegable: la flecha sobra y el padding
    // recorta el texto de las opciones.
    const i = CSS.indexOf('select[multiple]')
    expect(i).toBeGreaterThan(-1)
    const excepcion = CSS.slice(i, CSS.indexOf('}', i))
    expect(excepcion).toContain('background-image: none')
  })
})
