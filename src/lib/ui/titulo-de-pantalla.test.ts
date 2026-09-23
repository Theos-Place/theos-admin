import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { tituloDePantalla, SUFIJO } from './titulo-de-pantalla'

describe('título de pantalla', () => {
  it('lo específico va primero: es lo único que se ve en una pestaña angosta', () => {
    expect(tituloDePantalla('Grupo Discípulos 2', 'Estudios'))
      .toBe('Grupo Discípulos 2 · Estudios | Theos Place')
  })

  it('la sección es opcional', () => {
    expect(tituloDePantalla('Calendario')).toBe('Calendario | Theos Place')
  })

  it('vacío no deja un separador suelto', () => {
    expect(tituloDePantalla('')).toBe(SUFIJO)
    expect(tituloDePantalla('   ')).toBe(SUFIJO)
    expect(tituloDePantalla('Miembros', '  ')).toBe('Miembros | Theos Place')
  })

  it('usa el MISMO separador que la plantilla del layout raíz', () => {
    // Si no, una pantalla se vería distinta según quién le puso el título.
    const raiz = readFileSync('src/app/layout.tsx', 'utf8')
    expect(raiz).toContain(`template: '%s | ${SUFIJO}'`)
    expect(tituloDePantalla('X')).toBe(`X | ${SUFIJO}`)
  })
})
