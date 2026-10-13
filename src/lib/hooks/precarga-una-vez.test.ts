import { describe, it, expect } from 'vitest'
import { hayQueVolcar } from './precarga-una-vez'

describe('LINT-1 · cuándo se vuelca un formulario', () => {
  it('la primera vez que llega el dato, sí', () => {
    expect(hayQueVolcar('plantilla-1', null)).toBe(true)
  })

  it('con el mismo dato ya volcado, NO', () => {
    // Es lo que impide pisar lo que la persona está escribiendo: sin esto,
    // cada render devolvería el formulario a los valores del servidor.
    expect(hayQueVolcar('plantilla-1', 'plantilla-1')).toBe(false)
  })

  it('si el dato cambia de identidad, se vuelve a volcar', () => {
    // Navegar de /editar/1 a /editar/2 sin desmontar la pantalla.
    expect(hayQueVolcar('plantilla-2', 'plantilla-1')).toBe(true)
  })

  it('mientras no haya llegado nada, no se vuelca', () => {
    for (const vacio of [null, undefined, '']) {
      expect(hayQueVolcar(vacio, null), String(vacio)).toBe(false)
    }
  })

  it('un dato que desaparece no borra lo ya volcado', () => {
    // Si la carga falla o se limpia, el formulario se queda como está en vez
    // de vaciarse solo mientras la persona lo mira.
    expect(hayQueVolcar(null, 'plantilla-1')).toBe(false)
  })
})
