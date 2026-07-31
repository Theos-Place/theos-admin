import { describe, it, expect } from 'vitest'
import { groupZoneFilterOptions, zoneFilterParam, ZONE_ANY } from './group-zone-filter'

const activas = [{ id: 'alajuela', name: 'Alajuela' }, { id: 'cartago', name: 'Cartago' }]
const historicas = [
  { id: 'casona-escalante', name: 'Casona Escalante' },
  { id: 'heredia', name: 'Heredia' },
  { id: 'limon', name: 'Limón' },
]

describe('groupZoneFilterOptions', () => {
  it('ofrece las activas (igual que al crear un grupo)', () => {
    const opts = groupZoneFilterOptions({ activeSedes: activas, historicalSedes: [], zonesInGroups: [] })
    expect(opts.map(o => o.value)).toEqual(['alajuela', 'cartago'])
  })

  it('agrega "Todas las zonas" cuando hay grupos sin zona', () => {
    const opts = groupZoneFilterOptions({ activeSedes: activas, historicalSedes: [], zonesInGroups: [null, 'alajuela'] })
    expect(opts[0]).toEqual({ value: ZONE_ANY, label: 'Todas las zonas (sin sede)', historical: false })
  })

  it('de las históricas, SOLO las que tienen grupos', () => {
    const opts = groupZoneFilterOptions({
      activeSedes: activas, historicalSedes: historicas,
      zonesInGroups: ['casona-escalante', 'alajuela'],
    })
    expect(opts.map(o => o.value)).toEqual(['alajuela', 'cartago', 'casona-escalante'])
    expect(opts.find(o => o.value === 'casona-escalante')?.historical).toBe(true)
    // heredia y limon no tienen grupos: no se ofrecen.
    expect(opts.some(o => o.value === 'heredia')).toBe(false)
  })

  it('una zona activa no se duplica aunque también figure como histórica', () => {
    const opts = groupZoneFilterOptions({
      activeSedes: activas,
      historicalSedes: [{ id: 'alajuela', name: 'Alajuela' }],
      zonesInGroups: ['alajuela'],
    })
    expect(opts.filter(o => o.value === 'alajuela').length).toBe(1)
  })

  it('una zona que está en grupos pero no existe como sede se ofrece igual', () => {
    const opts = groupZoneFilterOptions({
      activeSedes: activas, historicalSedes: historicas,
      zonesInGroups: ['zona-vieja-del-import'],
    })
    expect(opts.map(o => o.value)).toContain('zona-vieja-del-import')
  })

  it('hasGroupsWithoutZone explícito manda sobre la deducción', () => {
    const opts = groupZoneFilterOptions({
      activeSedes: [], historicalSedes: [], zonesInGroups: ['alajuela'], hasGroupsWithoutZone: true,
    })
    expect(opts[0].value).toBe(ZONE_ANY)
  })
})

describe('zoneFilterParam', () => {
  it('vacío = sin filtro', () => {
    expect(zoneFilterParam('')).toEqual({})
  })

  it('"sin zona" viaja como zoneNull, no como zone', () => {
    expect(zoneFilterParam(ZONE_ANY)).toEqual({ zoneNull: true })
  })

  it('una zona normal viaja como zone', () => {
    expect(zoneFilterParam('alajuela')).toEqual({ zone: 'alajuela' })
  })
})
