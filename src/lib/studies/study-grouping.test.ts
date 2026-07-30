import { describe, it, expect } from 'vitest'
import { groupCodesForDisplay, matchesStudyFilter, expandSelectionValue } from './study-grouping'

const label = (c: string) => `nombre-${c}`

describe('groupCodesForDisplay', () => {
  it('un solo estudio de Niveles ya dice "Niveles" (no "parcial")', () => {
    const badges = groupCodesForDisplay(['N2'], label)
    expect(badges).toEqual([{ value: 'GRP:niveles', label: 'Niveles', codes: ['N2'] }])
  })

  it('el grupo completo se muestra igual', () => {
    const badges = groupCodesForDisplay(['N1', 'N2', 'N3', 'N4'], label)
    expect(badges.map(b => b.label)).toEqual(['Niveles'])
  })

  it('colapsa un grupo por badge y deja los individuales aparte', () => {
    const badges = groupCodesForDisplay(['N1', 'DIS1', 'N3', 'CDEB'], label)
    expect(badges.map(b => b.label)).toEqual(['Niveles', 'Discípulos', 'nombre-CDEB'])
    expect(badges[0].codes).toEqual(['N1', 'N3'])
  })

  it('los codes del badge son los que realmente tiene (para quitarlos al editar)', () => {
    expect(groupCodesForDisplay(['DIS3'], label)[0].codes).toEqual(['DIS3'])
  })
})

describe('filtros', () => {
  it('el grupo matchea con tener al menos uno', () => {
    expect(matchesStudyFilter(['N2'], 'GRP:niveles')).toBe(true)
    expect(matchesStudyFilter(['CDEB'], 'GRP:niveles')).toBe(false)
  })

  it('expandSelectionValue devuelve todos los codes del grupo', () => {
    expect(expandSelectionValue('GRP:discipulos')).toEqual(['DIS1', 'DIS2', 'DIS3'])
    expect(expandSelectionValue('CDEB')).toEqual(['CDEB'])
  })
})
