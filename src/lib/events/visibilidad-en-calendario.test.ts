import { describe, it, expect } from 'vitest'
import { loVeEnSuCalendario, visiblesEnCalendario } from './visibilidad-en-calendario'

const NADIE = { gestiona: false }

describe('un evento interno lo ve quien ya está adentro', () => {
  /**
   * El caso reportado: le comparten un evento privado, se inscribe, y no
   * aparece en su calendario.
   */
  it('inscrita en un evento interno: LO VE', () => {
    expect(loVeEnSuCalendario({ is_public: false, already_registered: true }, NADIE)).toBe(true)
  })

  /**
   * EL CASO QUE SE ESCAPÓ la primera vez. A quien le «comparten» un evento
   * se lo nombra ENCARGADO, no se lo inscribe: gestiona el evento entero
   * —inscripciones, check-in, todos los tabs—. La primera versión solo miró
   * la inscripción y por eso la persona que lo reportó siguió sin verlo.
   */
  it('ENCARGADA de un evento interno, sin estar inscrita: LO VE', () => {
    expect(loVeEnSuCalendario(
      { is_public: false, es_encargado: true, already_registered: false }, NADIE,
    )).toBe(true)
  })

  it('voluntaria en un evento interno: LO VE', () => {
    expect(loVeEnSuCalendario({ is_public: false, es_voluntario: true }, NADIE)).toBe(true)
  })

  it('sin nada que ver con él: NO lo ve', () => {
    // Para eso es interno: no se anuncia.
    expect(loVeEnSuCalendario({ is_public: false }, NADIE)).toBe(false)
  })
})

describe('lo demás no cambia', () => {
  it('un evento público lo ve cualquiera', () => {
    expect(loVeEnSuCalendario({ is_public: true }, NADIE)).toBe(true)
  })

  it('sin el campo cuenta como público', () => {
    // Los eventos anteriores a la columna: es lo que hace el resto del
    // sistema y cambiarlo acá los escondería a todos de golpe.
    expect(loVeEnSuCalendario({}, NADIE)).toBe(true)
    expect(loVeEnSuCalendario({ is_public: null }, NADIE)).toBe(true)
  })

  it('quien gestiona eventos los ve todos', () => {
    expect(loVeEnSuCalendario({ is_public: false }, { gestiona: true })).toBe(true)
  })
})

describe('el filtro de la lista', () => {
  it('deja pasar el público y el interno donde está inscrita', () => {
    const vistos = visiblesEnCalendario([
      { is_public: true },
      { is_public: false },
      { is_public: false, already_registered: true },
    ], NADIE)
    expect(vistos).toHaveLength(2)
    expect(vistos.map(e => e.is_public)).toEqual([true, false])
  })

  it('para quien gestiona no filtra nada', () => {
    const todos = [{ is_public: false }, { is_public: true }]
    expect(visiblesEnCalendario(todos, { gestiona: true })).toHaveLength(2)
  })
})
