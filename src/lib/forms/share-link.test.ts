import { describe, it, expect } from 'vitest'
import { sePuedeCompartir, formPath, formShareUrl, formShareLink } from './share-link'

describe('cuándo se puede compartir un formulario', () => {
  it('abierto y activo: sí', () => {
    expect(sePuedeCompartir({ is_public: true, is_active: true })).toBe(true)
  })

  it('no marcado como abierto: NO', () => {
    // formFillAccess lo rechazaría con "no está abierto para vos": repartir ese
    // link es mandar gente a una puerta cerrada.
    expect(sePuedeCompartir({ is_public: false, is_active: true })).toBe(false)
  })

  it('inactivo: NO, aunque sea abierto', () => {
    expect(sePuedeCompartir({ is_public: true, is_active: false })).toBe(false)
  })
})

describe('la URL', () => {
  it('usa el origen que se le pasa, para que un preview copie SU propio link', () => {
    expect(formShareUrl('abc', 'https://preview.vercel.app'))
      .toBe('https://preview.vercel.app/formularios/abc/responder')
  })

  it('no duplica la barra final', () => {
    expect(formShareUrl('abc', 'https://x.com/')).toBe('https://x.com/formularios/abc/responder')
  })

  it('el path es el que responde el formulario', () => {
    expect(formPath('abc')).toBe('/formularios/abc/responder')
  })
})

describe('formShareLink — cuál de los dos links', () => {
  it('abierto y sin cuenta → el link público', () => {
    expect(formShareLink({ id: 'f1', is_public: true, requires_auth: false }, 'https://x.test'))
      .toEqual({ url: 'https://x.test/formulario/f1', kind: 'publico' })
  })
  it('abierto pero con cuenta → el de siempre', () => {
    // Es el estado de los formularios de hoy: link para cualquiera, con sesión.
    expect(formShareLink({ id: 'f1', is_public: true, requires_auth: true }, 'https://x.test'))
      .toEqual({ url: 'https://x.test/formularios/f1/responder', kind: 'con-cuenta' })
  })
  it('sin requires_auth definido NO se asume público', () => {
    // Un formulario viejo sin el dato no puede volverse público por omisión.
    expect(formShareLink({ id: 'f1', is_public: true }, 'https://x.test').kind).toBe('con-cuenta')
  })
  it('no abierto → el de siempre, aunque no pida cuenta', () => {
    expect(formShareLink({ id: 'f1', is_public: false, requires_auth: false }, 'https://x.test').kind)
      .toBe('con-cuenta')
  })
})
