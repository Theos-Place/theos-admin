import { describe, it, expect } from 'vitest'
import { esEmbebible, origenesPermitidos, frameAncestors } from './embed'

describe('qué se puede embeber', () => {
  it('el calendario sí', () => {
    expect(esEmbebible('/calendario')).toBe(true)
    expect(esEmbebible('/calendario/abc')).toBe(true)
  })
  it('el resto del sistema NO', () => {
    // Dejarlo embebible habilita clickjacking sobre acciones de alguien con sesión.
    expect(esEmbebible('/miembros')).toBe(false)
    expect(esEmbebible('/finanzas/pagos')).toBe(false)
    expect(esEmbebible('/formularios')).toBe(false)
    expect(esEmbebible('/')).toBe(false)
  })
  it('nada que solo EMPIECE parecido', () => {
    expect(esEmbebible('/calendarios-privados')).toBe(false)
  })
})

describe('origenesPermitidos', () => {
  it('lee una lista separada por coma', () => {
    expect(origenesPermitidos('https://theosplace.com, https://www.theosplace.com'))
      .toEqual(['https://theosplace.com', 'https://www.theosplace.com'])
  })
  it('descarta lo que no es un origen completo', () => {
    // Un valor a medias no falla ruidosamente en frame-ancestors: simplemente
    // no matchea, y el iframe queda roto sin que nadie sepa por qué.
    expect(origenesPermitidos('theosplace.com')).toEqual([])
    expect(origenesPermitidos('https://theosplace.com/calendario')).toEqual([])
    expect(origenesPermitidos('*')).toEqual([])
  })
  it('vacío o sin definir da lista vacía', () => {
    expect(origenesPermitidos('')).toEqual([])
    expect(origenesPermitidos(undefined)).toEqual([])
  })
})

describe('frameAncestors', () => {
  const orig = ['https://theosplace.com']
  it('en el calendario suma los orígenes configurados', () => {
    expect(frameAncestors('/calendario', orig)).toBe("frame-ancestors 'self' https://theosplace.com")
  })
  it('fuera del calendario queda como SAMEORIGIN, aunque haya orígenes', () => {
    expect(frameAncestors('/miembros', orig)).toBe("frame-ancestors 'self'")
  })
  it('SIN orígenes configurados no abre nada: activar esto no cambia el estado actual', () => {
    expect(frameAncestors('/calendario', [])).toBe("frame-ancestors 'self'")
  })
})
