import { describe, it, expect } from 'vitest'
import { sedeDelArea, sedesDeLasAreas } from './sede-del-area'

// Las 12 sedes activas con comité, tal cual están en producción (2026-10-14).
const SEDES = [
  { code: 'alajuela', name: 'Sede Alajuela' }, { code: 'antares', name: 'Sede Antares' },
  { code: 'cartago', name: 'Sede Cartago' }, { code: 'guapiles', name: 'Sede Guápiles' },
  { code: 'liberia', name: 'Sede Liberia' }, { code: 'madrid', name: 'Sede Madrid' },
  { code: 'madrid-home', name: 'Sede Madrid Home' }, { code: 'meridiano', name: 'Sede Meridiano Martes' },
  { code: 'meridiano-miercoles', name: 'Sede Meridiano Miércoles' }, { code: 'united', name: 'Sede Pedregal Domingos' },
  { code: 'home', name: 'Sede Pedregal Jueves' }, { code: 'pedregal-miercoles', name: 'Sede Pedregal Miércoles' },
]

describe('FIN-12 · de qué sede es el comité', () => {
  it('las 12 áreas de sede de producción casan con su sede', () => {
    for (const s of SEDES) expect(sedeDelArea(s.name, SEDES)?.code, s.name).toBe(s.code)
  })

  it('«Sede Madrid» NO es «Sede Madrid Home»: nada de parecidos', () => {
    expect(sedeDelArea('Sede Madrid', SEDES)?.code).toBe('madrid')
    expect(sedeDelArea('Sede Madrid Home', SEDES)?.code).toBe('madrid-home')
  })

  it('sin tildes ni prefijo también', () => {
    expect(sedeDelArea('Area de Sede Guapiles', SEDES)?.code).toBe('guapiles')
  })

  it('un área que no es sede → null, no la más parecida', () => {
    expect(sedeDelArea('Comité Estudios Bíblicos', SEDES)).toBeNull()
    expect(sedeDelArea('Sede Pedregal', SEDES)).toBeNull()
  })

  it('dos sedes con el mismo nombre normalizado → null: es error del catálogo', () => {
    expect(sedeDelArea('Sede X', [{ code: 'x1', name: 'Sede X' }, { code: 'x2', name: 'SEDE X' }])).toBeNull()
  })

  it('las sedes de todas las áreas donde sirve, sin repetir', () => {
    expect(sedesDeLasAreas(['Sede Liberia', 'Comité Youth', 'Sede Liberia', 'Sede Cartago'], SEDES)).toEqual(['cartago', 'liberia'])
  })
})
