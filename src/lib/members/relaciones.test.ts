import { describe, it, expect } from 'vitest'
import { RELACIONES_FAMILIARES, esRelacionValida } from './relaciones'

describe('relaciones familiares', () => {
  it('incluye Titular, que antes el modal no ofrecía', () => {
    // La fusión puede dejar dos Titulares; sin esta opción no se podía corregir
    // ninguno de los dos desde la pantalla.
    expect(RELACIONES_FAMILIARES).toContain('Titular')
  })

  it('son las siete que la UI muestra', () => {
    expect([...RELACIONES_FAMILIARES])
      .toEqual(['Titular', 'Cónyuge', 'Hijo/a', 'Padre', 'Madre', 'Hermano/a', 'Otro'])
  })

  it('acepta solo las de la lista', () => {
    for (const r of RELACIONES_FAMILIARES) expect(esRelacionValida(r)).toBe(true)
  })

  it('rechaza cualquier otra cosa', () => {
    for (const v of ['titular', 'Primo', '', ' Otro', null, 3, undefined, {}]) {
      expect(esRelacionValida(v)).toBe(false)
    }
  })
})
