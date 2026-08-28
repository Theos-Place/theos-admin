import { describe, it, expect } from 'vitest'
import { isPublic } from '@/proxy'

// El prefijo público '/formulario' (singular) convive con el módulo
// '/formularios' (plural), que NO es público. Un prefijo mal escrito abriría el
// módulo entero al mundo, así que la distinción se fija acá.
describe('el prefijo público de formularios no abre el módulo', () => {
  it('la página pública pasa', () => {
    expect(isPublic('/formulario/abc-123')).toBe(true)
  })
  it('el MÓDULO sigue protegido', () => {
    expect(isPublic('/formularios')).toBe(false)
    expect(isPublic('/formularios/abc-123')).toBe(false)
    expect(isPublic('/formularios/abc-123/respuestas')).toBe(false)
    expect(isPublic('/formularios/abc-123/seleccion')).toBe(false)
  })
  it('nada que solo EMPIECE parecido pasa', () => {
    expect(isPublic('/formularioss')).toBe(false)
    expect(isPublic('/formulario-secreto')).toBe(false)
  })
  it('los otros prefijos siguen como estaban', () => {
    expect(isPublic('/calendario/1')).toBe(true)
    expect(isPublic('/miembros')).toBe(false)
    expect(isPublic('/estudios/grupos')).toBe(false)
  })
})
