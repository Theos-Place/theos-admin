import { describe, it, expect } from 'vitest'
import {
  estadoMostrado, conteoDeEstados, resumenDeDirigentes, ETIQUETA_MOSTRADA,
} from './estado-mostrado'

describe('DIR-14 · el estado que se muestra es el ADMINISTRATIVO', () => {
  it('activo e inactivo salen de estado_base', () => {
    expect(estadoMostrado('activo')).toBe('activo')
    expect(estadoMostrado('inactivo')).toBe('inactivo')
  })

  it('SIN FICHA no es «inactivo»', () => {
    // Llamarla inactiva inventa una decisión que nadie tomó. Esta persona
    // llegó a la lista por otro camino y hay que abrirle ficha.
    expect(estadoMostrado(null)).toBe('sin_ficha')
    expect(estadoMostrado(undefined)).toBe('sin_ficha')
    expect(estadoMostrado('')).toBe('sin_ficha')
  })

  it('un valor que no conocemos tampoco se da por inactivo', () => {
    expect(estadoMostrado('pausado')).toBe('sin_ficha')
  })
})

describe('DIR-14 · los conteos SUMAN el total de la lista', () => {
  // Era el síntoma: 210 + 375 del encabezado no eran los 333 + 245 de los
  // chips, y ninguna de las dos sumas daba la cantidad de filas.
  const lista = [
    { estado_base: 'activo' }, { estado_base: 'activo' },
    { estado_base: 'inactivo' },
    { estado_base: null },
  ]

  it('tres grupos y un total que cuadra', () => {
    const c = conteoDeEstados(lista)
    expect(c).toEqual({ activos: 2, inactivos: 1, sinFicha: 1, total: 4 })
    expect(c.activos + c.inactivos + c.sinFicha).toBe(c.total)
  })

  it('con cualquier mezcla, sigue cuadrando', () => {
    const grande = Array.from({ length: 50 }, (_, i) => ({
      estado_base: i % 3 === 0 ? 'activo' : i % 3 === 1 ? 'inactivo' : null,
    }))
    const c = conteoDeEstados(grande)
    expect(c.activos + c.inactivos + c.sinFicha).toBe(50)
  })

  it('lista vacía', () => {
    expect(conteoDeEstados([])).toEqual({ activos: 0, inactivos: 0, sinFicha: 0, total: 0 })
  })
})

describe('DIR-14 · el texto del encabezado', () => {
  it('menciona «sin ficha» solo si hay', () => {
    expect(resumenDeDirigentes({ activos: 333, inactivos: 245, sinFicha: 7, total: 585 }))
      .toBe('333 activos · 245 inactivos · 7 sin ficha')
    expect(resumenDeDirigentes({ activos: 333, inactivos: 245, sinFicha: 0, total: 578 }))
      .toBe('333 activos · 245 inactivos')
  })

  it('las tres etiquetas existen', () => {
    expect(ETIQUETA_MOSTRADA.sin_ficha).toBe('Sin ficha')
  })
})
