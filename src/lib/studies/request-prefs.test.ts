import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { requestZones, relocationGroupScore, ANY_ZONE, zonaCoincide } from './request-prefs'

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
    const zonaSola = relocationGroupScore({ zoneCode: null, zoneName: 'Heredia', schedule_days: ['V'] }, prefs)
    const diaSolo = relocationGroupScore({ zoneCode: null, zoneName: 'Cartago', schedule_days: ['L'] }, prefs)
    expect(zonaSola).toBeGreaterThan(diaSolo)
  })

  it('zona + día = puntaje máximo (3); nada = 0', () => {
    expect(relocationGroupScore({ zoneCode: null, zoneName: 'Alajuela', schedule_days: ['X'] }, prefs)).toBe(3)
    expect(relocationGroupScore({ zoneCode: null, zoneName: 'Cartago', schedule_days: ['V'] }, prefs)).toBe(0)
  })

  it('"Cualquiera" coincide con toda zona', () => {
    expect(relocationGroupScore({ zoneCode: null, zoneName: 'Liberia', schedule_days: [] }, { zones: [ANY_ZONE], days: [] })).toBe(2)
  })

  it('días de la solicitud (nombres) matchean las iniciales del grupo', () => {
    expect(relocationGroupScore({ zoneCode: null, zoneName: null, schedule_days: ['M'] }, { zones: [], days: ['Martes'] })).toBe(1)
  })

  it('sin preferencias todo puntúa 0 (el orden original se conserva)', () => {
    expect(relocationGroupScore({ zoneCode: null, zoneName: 'Heredia', schedule_days: ['L'] }, { zones: [], days: [] })).toBe(0)
  })
})

/**
 * DAT-13b · Las preferencias de zona se guardan por CÓDIGO desde el
 * 2026-09-24, porque los nombres cambian. Ese mismo día una zona pasó de «Sede
 * Pedregal Miércoles (código viejo)» a «Heredia», y cualquier preferencia
 * guardada por nombre se habría quedado apuntando a la nada sin fallar.
 */
describe('zonaCoincide · código o nombre', () => {
  const grupo = { zoneCode: 'la-sabana', zoneName: 'La Sabana' }

  it('coincide por código, que es como se guarda ahora', () => {
    expect(zonaCoincide(grupo, 'la-sabana')).toBe(true)
  })

  it('coincide por nombre, que es como quedaron las viejas', () => {
    // `proposed_location` es TEXTO LIBRE y va a seguir siéndolo, así que esta
    // rama no es deuda: es la que sostiene el «otra» del formulario.
    expect(zonaCoincide(grupo, 'La Sabana')).toBe(true)
    expect(zonaCoincide(grupo, 'la sabana')).toBe(true)
  })

  it('no coincide con otra zona', () => {
    expect(zonaCoincide(grupo, 'escazu')).toBe(false)
    expect(zonaCoincide(grupo, 'Escazú')).toBe(false)
  })

  it('un grupo sin zona no coincide con nada', () => {
    expect(zonaCoincide({ zoneCode: null, zoneName: null }, 'la-sabana')).toBe(false)
  })

  it('una preferencia vacía no coincide con nada', () => {
    // Sin esto, `''` contra un `zoneName` vacío daría true y el grupo puntuaría
    // como si cumpliera la preferencia.
    expect(zonaCoincide(grupo, '')).toBe(false)
    expect(zonaCoincide({ zoneCode: null, zoneName: '' }, '  ')).toBe(false)
  })

  it('el scoring funciona con códigos igual que con nombres', () => {
    const porCodigo = relocationGroupScore(
      { ...grupo, schedule_days: ['L'] }, { zones: ['la-sabana'], days: [] })
    const porNombre = relocationGroupScore(
      { ...grupo, schedule_days: ['L'] }, { zones: ['La Sabana'], days: [] })
    expect(porCodigo).toBe(2)
    expect(porNombre).toBe(2)
  })

  it('el formulario guarda el CÓDIGO y muestra el NOMBRE', () => {
    const ui = readFileSync('src/components/studies/StudyRequestActions.tsx', 'utf8')
    expect(ui).toContain('zoneSedes.map(sd => ({ valor: sd.id, texto: sd.name }))')
    // Si vuelve a guardar el nombre, esto se cae.
    expect(ui).not.toContain('zoneSedes.map(sd => sd.name)')
  })
})
