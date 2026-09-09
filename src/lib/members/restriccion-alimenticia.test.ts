import { describe, it, expect } from 'vitest'
import {
  RESTRICCIONES_ALIMENTICIAS, esClaveValida, normalizarRestricciones, textoDeRestricciones,
} from './restriccion-alimenticia'

describe('el catálogo', () => {
  it('son las cuatro opciones pedidas, con claves estables en vez de etiquetas', () => {
    expect(RESTRICCIONES_ALIMENTICIAS.map(r => r.clave))
      .toEqual(['celiaquia', 'intolerancia_lactosa', 'vegana', 'otros'])
  })

  it('las etiquetas en español viven en el código, no en la base', () => {
    expect(RESTRICCIONES_ALIMENTICIAS.map(r => r.etiqueta))
      .toEqual(['Celiaquía', 'Intolerancia a la lactosa', 'Persona vegana', 'Otros'])
  })

  it('solo acepta claves del catálogo', () => {
    expect(esClaveValida('celiaquia')).toBe(true)
    for (const v of ['Celiaquía', 'vegano', '', null, 3]) expect(esClaveValida(v)).toBe(false)
  })
})

describe('normalizar', () => {
  it('guarda varias a la vez', () => {
    const r = normalizarRestricciones(['vegana', 'celiaquia'], null)
    expect(r.ok).toBe(true)
    expect(r.restricciones).toEqual(['celiaquia', 'vegana'])
  })

  it('ordena según el catálogo, no según en qué orden se tocaron', () => {
    const a = normalizarRestricciones(['vegana', 'intolerancia_lactosa', 'celiaquia'], null)
    const b = normalizarRestricciones(['celiaquia', 'vegana', 'intolerancia_lactosa'], null)
    expect(a.restricciones).toEqual(b.restricciones)
  })

  it('quita repetidos', () => {
    expect(normalizarRestricciones(['vegana', 'vegana'], null).restricciones).toEqual(['vegana'])
  })

  it('«Otros» con texto guarda las dos cosas', () => {
    const r = normalizarRestricciones(['otros'], '  alergia al huevo  ')
    expect(r.ok).toBe(true)
    expect(r.restricciones).toEqual(['otros'])
    expect(r.otro).toBe('alergia al huevo')
  })

  it('«Otros» SIN texto es un error: la opción sola no le dice nada a la cocina', () => {
    const r = normalizarRestricciones(['otros'], '')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/escribí cuál/i)
  })

  it('texto SIN «Otros» marca el checkbox solo, no descarta lo escrito', () => {
    // Decisión documentada: en el celular es fácil escribir y que el toque del
    // checkbox no registre; tirar el texto perdería un dato real.
    const r = normalizarRestricciones([], 'sin gluten ni maní')
    expect(r.ok).toBe(true)
    expect(r.restricciones).toEqual(['otros'])
    expect(r.otro).toBe('sin gluten ni maní')
  })

  it('sin «Otros» el texto no se guarda', () => {
    expect(normalizarRestricciones(['vegana'], null).otro).toBeNull()
  })

  it('una clave fuera del catálogo se rechaza y nombra cuál', () => {
    const r = normalizarRestricciones(['vegana', 'carnivoro'], null)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/carnivoro/)
  })

  it('lista vacía o basura no revienta', () => {
    expect(normalizarRestricciones([], null)).toEqual({ ok: true, restricciones: [], otro: null })
    expect(normalizarRestricciones(null, null).ok).toBe(true)
    expect(normalizarRestricciones('texto', null).ok).toBe(true)
  })
})

describe('cómo se lee', () => {
  it('lista las etiquetas en español', () => {
    expect(textoDeRestricciones(['celiaquia', 'vegana'], null))
      .toBe('Celiaquía, Persona vegana')
  })

  it('«Otros» muestra el detalle, que es lo que la cocina necesita', () => {
    expect(textoDeRestricciones(['otros'], 'alergia al huevo'))
      .toBe('Otros: alergia al huevo')
  })

  it('sin restricciones da un guion, no una cadena vacía', () => {
    expect(textoDeRestricciones([], null)).toBe('—')
    expect(textoDeRestricciones(null, null)).toBe('—')
  })

  it('ignora claves viejas o corruptas en vez de mostrarlas crudas', () => {
    expect(textoDeRestricciones(['vegana', 'basura'], null)).toBe('Persona vegana')
  })
})
