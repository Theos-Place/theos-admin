import { describe, it, expect } from 'vitest'
import { sePuedeCompartir, formPath, formShareUrl } from './share-link'

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
