import { describe, it, expect } from 'vitest'
import { esPuestoDeDirigente, COMITE_DIRIGENTES, PUESTO_POR_DEFECTO } from './comite-de-dirigentes'

describe('esPuestoDeDirigente', () => {
  it('los tres puestos que cuentan hoy', () => {
    for (const p of ['Dirigente CR', 'Dirigente Madrid', 'Dirigente']) {
      expect(esPuestoDeDirigente(p), p).toBe(true)
    }
  })

  it('los del comité que NO dan estudios quedan fuera', () => {
    // Están en el mismo comité, pero no son dirigentes.
    expect(esPuestoDeDirigente('Encargado Dirigentes')).toBe(false)
    expect(esPuestoDeDirigente('Colaborador retroalimentación')).toBe(false)
  })

  it('no se cae por tildes ni mayúsculas', () => {
    // El título lo escribe una persona en un formulario.
    expect(esPuestoDeDirigente('DIRIGENTE CR')).toBe(true)
    expect(esPuestoDeDirigente('  dirigente madrid ')).toBe(true)
  })

  it('sin puesto no hay dirigente', () => {
    expect(esPuestoDeDirigente(null)).toBe(false)
    expect(esPuestoDeDirigente(undefined)).toBe(false)
    expect(esPuestoDeDirigente('')).toBe(false)
  })

  it('el nombre del comité es el que EXISTE en la base', () => {
    // Todo esto empezó porque el código decía "Comité de Dirigentes" y el
    // comité se llama sin el "de". Si alguien lo renombra, este test cae.
    expect(COMITE_DIRIGENTES).toBe('Comité Dirigentes')
    expect(esPuestoDeDirigente(PUESTO_POR_DEFECTO)).toBe(true)
  })
})
