import { describe, it, expect } from 'vitest'
import { claveDeBusqueda, estadoDeBusqueda } from './busqueda-diferida'

describe('claveDeBusqueda', () => {
  it('recorta y exige el mínimo', () => {
    expect(claveDeBusqueda('  ma ', 2)).toBe('ma')
    expect(claveDeBusqueda('m', 2)).toBe('')
    expect(claveDeBusqueda('   ', 1)).toBe('')
  })

  it('apagada, nunca busca', () => {
    expect(claveDeBusqueda('mario', 2, false)).toBe('')
  })
})

describe('estadoDeBusqueda', () => {
  const guardado = { clave: 'mar', resultados: [1, 2] }

  it('sin clave: nada que mostrar y no está buscando', () => {
    expect(estadoDeBusqueda('', guardado)).toEqual({ resultados: [], buscando: false })
  })

  it('con lo guardado al día: lo muestra', () => {
    expect(estadoDeBusqueda('mar', guardado)).toEqual({ resultados: [1, 2], buscando: false })
  })

  it('consulta nueva: lista vacía y buscando, aunque haya algo viejo guardado', () => {
    // El cebo: devolver los resultados de «mar» mientras se escribe «mario».
    expect(estadoDeBusqueda('mario', guardado)).toEqual({ resultados: [], buscando: true })
    expect(estadoDeBusqueda('mar', null)).toEqual({ resultados: [], buscando: true })
  })
})
