import { describe, it, expect } from 'vitest'
import { anchoDestino, valeLaPena, resumenOptimizacion, MAX_ANCHO } from './flyer-optimize'

describe('anchoDestino', () => {
  it('achica lo que se pasa del máximo', () => {
    // El caso real: dos de los cuatro flyers de la base miden 3400 y 3000 px.
    expect(anchoDestino({ width: 3400, height: 1913 })).toBe(MAX_ANCHO)
    expect(anchoDestino({ width: 3000, height: 1689 })).toBe(MAX_ANCHO)
  })
  it('NO agranda lo que ya es chico', () => {
    expect(anchoDestino({ width: 735, height: 488 })).toBeNull()
    expect(anchoDestino({ width: 1440, height: 804 })).toBeNull()
  })
  it('justo en el límite no toca nada', () => {
    expect(anchoDestino({ width: MAX_ANCHO, height: 900 })).toBeNull()
  })
  it('sin ancho conocido, no hace nada', () => {
    expect(anchoDestino({ width: 0, height: 0 })).toBeNull()
  })
})

describe('valeLaPena', () => {
  it('sí cuando achica de verdad', () => {
    expect(valeLaPena(1_070_000, 130_000)).toBe(true)
  })
  it('no cuando apenas cambia: convertir por convertir no paga', () => {
    expect(valeLaPena(19_000, 18_500)).toBe(false)
  })
  it('no cuando queda MÁS grande', () => {
    expect(valeLaPena(19_000, 24_000)).toBe(false)
  })
  it('no con un resultado vacío', () => {
    expect(valeLaPena(19_000, 0)).toBe(false)
  })
})

describe('resumenOptimizacion', () => {
  it('dice el antes y el después en unidades legibles', () => {
    expect(resumenOptimizacion(
      { width: 3400, height: 1913, bytes: 1_096_000 },
      { width: 1600, height: 900, bytes: 131_072 },
    )).toBe('3400×1913, 1.0 MB → 1600×900, 128 KB')
  })
})
