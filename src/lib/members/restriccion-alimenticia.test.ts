import { describe, it, expect } from 'vitest'
import {
  RESTRICCIONES_ALIMENTICIAS, esClaveValida, normalizarRestricciones, textoDeRestricciones,
} from './restriccion-alimenticia'

describe('el catálogo', () => {
  it('son tres opciones y la lista es CERRADA — «Otros» se quitó a propósito', () => {
    expect(RESTRICCIONES_ALIMENTICIAS.map(r => r.clave))
      .toEqual(['celiaquia', 'intolerancia_lactosa', 'vegana'])
  })

  it('las etiquetas en español viven en el código, no en la base', () => {
    expect(RESTRICCIONES_ALIMENTICIAS.map(r => r.etiqueta))
      .toEqual(['Celiaquía', 'Intolerancia a la lactosa', 'Persona vegana'])
  })

  it('«otros» ya no es una clave válida', () => {
    expect(esClaveValida('otros')).toBe(false)
  })

  it('solo acepta claves del catálogo', () => {
    expect(esClaveValida('celiaquia')).toBe(true)
    for (const v of ['Celiaquía', 'vegano', '', null, 3]) expect(esClaveValida(v)).toBe(false)
  })
})

describe('normalizar', () => {
  it('guarda varias a la vez', () => {
    const r = normalizarRestricciones(['vegana', 'celiaquia'])
    expect(r.ok).toBe(true)
    expect(r.restricciones).toEqual(['celiaquia', 'vegana'])
  })

  it('ordena según el catálogo, no según en qué orden se tocaron', () => {
    expect(normalizarRestricciones(['vegana', 'celiaquia']).restricciones)
      .toEqual(normalizarRestricciones(['celiaquia', 'vegana']).restricciones)
  })

  it('quita repetidos', () => {
    expect(normalizarRestricciones(['vegana', 'vegana']).restricciones).toEqual(['vegana'])
  })

  it('una clave fuera del catálogo se rechaza y nombra cuál', () => {
    const r = normalizarRestricciones(['vegana', 'carnivoro'])
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/carnivoro/)
  })

  it('«otros», que antes valía, ahora se rechaza', () => {
    expect(normalizarRestricciones(['otros']).ok).toBe(false)
  })

  it('lista vacía o basura no revienta', () => {
    expect(normalizarRestricciones([])).toEqual({ ok: true, restricciones: [] })
    expect(normalizarRestricciones(null).ok).toBe(true)
    expect(normalizarRestricciones('texto').ok).toBe(true)
  })
})

describe('cómo se lee', () => {
  it('lista las etiquetas en español', () => {
    expect(textoDeRestricciones(['celiaquia', 'vegana'])).toBe('Celiaquía, Persona vegana')
  })

  it('sin restricciones da un guion, no una cadena vacía', () => {
    expect(textoDeRestricciones([])).toBe('—')
    expect(textoDeRestricciones(null)).toBe('—')
  })

  it('ignora claves viejas o corruptas en vez de mostrarlas crudas', () => {
    // Incluye 'otros', que pudo quedar en datos viejos aunque hoy no sea válida.
    expect(textoDeRestricciones(['vegana', 'otros', 'basura'])).toBe('Persona vegana')
  })
})
