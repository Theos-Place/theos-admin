import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ocupacion, textoDeSinFicha, textoDeTotales, totalesDeInscripcion } from './totales-de-inscripcion'

describe('EVE-14 · totalesDeInscripcion', () => {
  it('Matrimonios: 13 con ficha + 5 por el link, por pareja → 18 inscripciones y ~36 asistentes', () => {
    const t = totalesDeInscripcion({ conFicha: 13, sinFicha: 5, personasPorInscripcion: 2 })
    expect(t).toEqual({ conFicha: 13, sinFicha: 5, inscripciones: 18, personasPorInscripcion: 2, asistentesEstimados: 36 })
    expect(textoDeTotales(t)).toBe('18 inscripciones · ~36 asistentes')
    expect(textoDeSinFicha(t)).toBe('13 con ficha + 5 por el link sin ficha')
  })
  it('un evento individual no inventa estimado ni desglose', () => {
    const t = totalesDeInscripcion({ conFicha: 1 })
    expect(textoDeTotales(t)).toBe('1 inscripción')
    expect(textoDeSinFicha(t)).toBeNull()
  })
  it('el multiplicador nunca baja de 1 y se redondea', () => {
    expect(totalesDeInscripcion({ conFicha: 4, personasPorInscripcion: 0 }).asistentesEstimados).toBe(4)
    expect(totalesDeInscripcion({ conFicha: 4, personasPorInscripcion: null }).asistentesEstimados).toBe(4)
  })
  it('la ocupación se mide en personas contra el cupo', () => {
    const t = totalesDeInscripcion({ conFicha: 13, personasPorInscripcion: 2 })
    expect(ocupacion(t, 40)).toEqual({ usado: 26, cupo: 40, porcentaje: 65 })
    expect(ocupacion(t, null)).toEqual({ usado: 26, cupo: null, porcentaje: 0 })
  })
  it('cableado: la migración crea la columna con tope y marca Matrimonios por pareja', () => {
    const sql = readFileSync('supabase/migrations/20261030120000_eve14_personas_por_inscripcion.sql', 'utf8')
    expect(sql).toContain('personas_por_inscripcion smallint not null default 1')
    expect(sql).toContain('between 1 and 10')
    expect(sql).toContain("cc4a64b9-843d-4dc9-9232-2574b18c477b")
    const mapper = readFileSync('src/lib/events/form-mapper.ts', 'utf8')
    expect(mapper).toContain("personas_por_inscripcion: 'personas_por_inscripcion'")
  })
})
