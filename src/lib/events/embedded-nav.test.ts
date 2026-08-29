import { describe, it, expect } from 'vitest'
import { estaEmbebido, comoNavegar } from './embedded-nav'

describe('estaEmbebido', () => {
  it('suelto en su propia pestaña: no', () => {
    const w = {} as { self: unknown; top: unknown }
    w.self = w; w.top = w
    expect(estaEmbebido(w)).toBe(false)
  })
  it('dentro de un iframe del mismo origen: sí', () => {
    expect(estaEmbebido({ self: {}, top: {} })).toBe(true)
  })
  it('dentro de un iframe de OTRO origen: sí', () => {
    // Leer window.top desde un contenedor ajeno tira una excepción de
    // seguridad, y que la tire ya es la respuesta.
    const w = { self: {}, get top(): unknown { throw new Error('SecurityError') } }
    expect(estaEmbebido(w as never)).toBe(true)
  })
})

describe('comoNavegar', () => {
  it('embebido abre pestaña nueva: el calendario se queda donde estaba', () => {
    expect(comoNavegar('/eventos?register=1', true))
      .toEqual({ modo: 'pestaña-nueva', url: '/eventos?register=1' })
  })
  it('sin iframe, navegación normal', () => {
    expect(comoNavegar('/eventos?register=1', false))
      .toEqual({ modo: 'misma-pestaña', url: '/eventos?register=1' })
  })
})
