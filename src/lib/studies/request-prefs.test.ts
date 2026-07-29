import { describe, it, expect } from 'vitest'
import { requestZones, relocationGroupScore, ANY_ZONE } from './request-prefs'

describe('requestZones (REU-1)', () => {
  it('solicitud nueva: zonas múltiples de proposed_zones', () => {
    expect(requestZones({ proposed_zones: ['Heredia', 'Alajuela'], proposed_location: null }))
      .toEqual(['Heredia', 'Alajuela'])
  })

  it('solicitud VIEJA (una zona en proposed_location) se lee igual', () => {
    expect(requestZones({ proposed_zones: [], proposed_location: 'Cartago' })).toEqual(['Cartago'])
    expect(requestZones({ proposed_zones: null, proposed_location: 'Cartago' })).toEqual(['Cartago'])
  })

  it('sin preferencias → lista vacía', () => {
    expect(requestZones({ proposed_zones: [], proposed_location: null })).toEqual([])
    expect(requestZones({ proposed_zones: [], proposed_location: '  ' })).toEqual([])
  })

  it('si hay múltiples, la vieja no se duplica', () => {
    expect(requestZones({ proposed_zones: ['Heredia'], proposed_location: 'Cartago' })).toEqual(['Heredia'])
  })
})

describe('relocationGroupScore (REU-1)', () => {
  const prefs = { zones: ['Heredia', 'Alajuela'], days: ['Lunes', 'Miércoles'] }

  it('zona pedida pesa más que el día', () => {
    const zonaSola = relocationGroupScore({ zoneName: 'Heredia', schedule_days: ['V'] }, prefs)
    const diaSolo = relocationGroupScore({ zoneName: 'Cartago', schedule_days: ['L'] }, prefs)
    expect(zonaSola).toBeGreaterThan(diaSolo)
  })

  it('zona + día = puntaje máximo (3); nada = 0', () => {
    expect(relocationGroupScore({ zoneName: 'Alajuela', schedule_days: ['X'] }, prefs)).toBe(3)
    expect(relocationGroupScore({ zoneName: 'Cartago', schedule_days: ['V'] }, prefs)).toBe(0)
  })

  it('"Cualquiera" coincide con toda zona', () => {
    expect(relocationGroupScore({ zoneName: 'Liberia', schedule_days: [] }, { zones: [ANY_ZONE], days: [] })).toBe(2)
  })

  it('días de la solicitud (nombres) matchean las iniciales del grupo', () => {
    expect(relocationGroupScore({ zoneName: null, schedule_days: ['M'] }, { zones: [], days: ['Martes'] })).toBe(1)
  })

  it('sin preferencias todo puntúa 0 (el orden original se conserva)', () => {
    expect(relocationGroupScore({ zoneName: 'Heredia', schedule_days: ['L'] }, { zones: [], days: [] })).toBe(0)
  })
})
