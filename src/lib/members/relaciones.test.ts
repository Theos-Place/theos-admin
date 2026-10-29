import { describe, it, expect } from 'vitest'
import { RELACIONES_FAMILIARES, esRelacionValida, parentescoVistoDesde } from './relaciones'

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

describe('parentescoVistoDesde (FAM-3)', () => {
  const p = parentescoVistoDesde
  it('desde la mamá los hijos son hijos, con género', () => {
    expect(p('Titular', 'Hijo/a', 'M')).toBe('Hijo')
    expect(p('Cónyuge', 'Hijo/a', 'F')).toBe('Hija')
    expect(p('Titular', 'Hijo/a', null)).toBe('Hijo/a')
  })
  it('desde un hijo, la Titular es su madre y el otro Hijo/a su hermano', () => {
    // Era el reclamo: en el perfil del hijo la mamá salía «Titular».
    expect(p('Hijo/a', 'Titular', 'F')).toBe('Madre')
    expect(p('Hijo/a', 'Cónyuge', 'M')).toBe('Padre')
    expect(p('Hijo/a', 'Hijo/a', 'F')).toBe('Hermana')
    expect(p('Hijo/a', 'Hijo/a', 'otro')).toBe('Hermano/a')
  })
  it('la pareja se ve como cónyuge en los dos sentidos', () => {
    expect(p('Titular', 'Cónyuge', 'F')).toBe('Cónyuge')
    expect(p('Cónyuge', 'Titular', 'M')).toBe('Cónyuge')
    expect(p('Titular', 'Titular', 'M')).toBe('Cónyuge') // dos Titulares tras una fusión
  })
  it('Madre/Padre/Hermano se guardan respecto al Titular y se leen así', () => {
    expect(p('Titular', 'Madre', 'F')).toBe('Madre')
    expect(p('Madre', 'Titular', 'F')).toBe('Hija')
    expect(p('Madre', 'Hijo/a', 'M')).toBe('Nieto')
    expect(p('Hijo/a', 'Madre', 'F')).toBe('Abuela')
    expect(p('Hermano/a', 'Titular', 'F')).toBe('Hermana')
    expect(p('Hermano/a', 'Hermano/a', 'M')).toBe('Hermano')
    expect(p('Titular', 'Hermano/a', 'M')).toBe('Hermano')
    expect(p('Hijo/a', 'Hermano/a', 'F')).toBe('Tía')
  })
  it('lo que no sabe traducir devuelve el rol guardado, como antes', () => {
    expect(p('Otro', 'Titular', 'F')).toBe('Titular')
    expect(p('Titular', 'Otro', 'F')).toBe('Otro')
    expect(p(null, 'Hijo/a', 'M')).toBe('Hijo/a')
    expect(p('Titular', '', 'M')).toBe('Otro')
  })
})
