import { describe, it, expect } from 'vitest'
import {
  visibleEventTabs, canSeeEventManagementData, registrationCta,
} from './detail-access'

const NOW = new Date('2026-07-31T12:00:00Z')
const FUTURO = '2026-08-15T02:00:00Z'
const PASADO = '2026-07-01T02:00:00Z'

const event = (over: Partial<{ requires_registration: boolean; status: string; end_at: string }> = {}) => ({
  requires_registration: true, status: 'published', end_at: FUTURO, ...over,
})

const elig = (over: Partial<{ already_registered: boolean; is_eligible: boolean; is_full: boolean; reasons_blocked: string[] }> = {}) => ({
  already_registered: false, is_eligible: true, is_full: false, reasons_blocked: [], ...over,
})

describe('visibleEventTabs', () => {
  it('sin permisos: solo Información (la parte pública de la ficha)', () => {
    expect(visibleEventTabs({ canManage: false, canCheckin: false, canReport: false }))
      .toEqual(['informacion'])
  })

  it('check-in y reportes tienen su propio permiso', () => {
    expect(visibleEventTabs({ canManage: false, canCheckin: true, canReport: false }))
      .toEqual(['informacion', 'checkin'])
    expect(visibleEventTabs({ canManage: false, canCheckin: false, canReport: true }))
      .toEqual(['informacion', 'reportes'])
  })

  it('gestión abre inscripciones, servidores y comunicaciones', () => {
    expect(visibleEventTabs({ canManage: true, canCheckin: true, canReport: true }))
      .toEqual(['informacion', 'inscripciones', 'checkin', 'servidores', 'comunicaciones', 'reportes'])
  })
})

describe('canSeeEventManagementData', () => {
  it('cualquier permiso de eventos alcanza', () => {
    expect(canSeeEventManagementData({ canManage: true, canCheckin: false, canReport: false })).toBe(true)
    expect(canSeeEventManagementData({ canManage: false, canCheckin: true, canReport: false })).toBe(true)
    expect(canSeeEventManagementData({ canManage: false, canCheckin: false, canReport: true })).toBe(true)
  })

  it('sin ninguno, no ve inscritos ni check-ins', () => {
    expect(canSeeEventManagementData({ canManage: false, canCheckin: false, canReport: false })).toBe(false)
  })
})

describe('registrationCta', () => {
  it('elegible → botón de inscribirse', () => {
    expect(registrationCta(event(), elig(), NOW)).toEqual({ kind: 'inscribirse' })
  })

  it('ya inscrito → estado, sin botón (incluso si el evento pasó)', () => {
    expect(registrationCta(event(), elig({ already_registered: true }), NOW)).toEqual({ kind: 'inscrito' })
    expect(registrationCta(event({ end_at: PASADO }), elig({ already_registered: true }), NOW))
      .toEqual({ kind: 'inscrito' })
  })

  it('el evento sin inscripción no muestra nada', () => {
    expect(registrationCta(event({ requires_registration: false }), elig(), NOW)).toEqual({ kind: 'ninguno' })
  })

  it('cancelado, archivado o ya terminado: nada', () => {
    expect(registrationCta(event({ status: 'cancelled' }), elig(), NOW)).toEqual({ kind: 'ninguno' })
    expect(registrationCta(event({ status: 'archived' }), elig(), NOW)).toEqual({ kind: 'ninguno' })
    expect(registrationCta(event({ end_at: PASADO }), elig(), NOW)).toEqual({ kind: 'ninguno' })
  })

  it('bloqueado: se explica por qué', () => {
    expect(registrationCta(event(), elig({ is_eligible: false, reasons_blocked: ['Falta tu cédula'] }), NOW))
      .toEqual({ kind: 'bloqueado', reasons: ['Falta tu cédula'] })
  })

  it('lleno sin razones explícitas: lo dice igual', () => {
    expect(registrationCta(event(), elig({ is_eligible: false, is_full: true }), NOW))
      .toEqual({ kind: 'bloqueado', reasons: ['El evento ya está lleno.'] })
  })

  it('sin razones ni cupo lleno: mensaje genérico, nunca un botón que falle', () => {
    expect(registrationCta(event(), elig({ is_eligible: false }), NOW))
      .toEqual({ kind: 'bloqueado', reasons: ['No cumplís los requisitos de este evento.'] })
  })

  it('sin elegibilidad cargada todavía: nada (no se pinta un botón que no sabemos si sirve)', () => {
    expect(registrationCta(event(), null, NOW)).toEqual({ kind: 'ninguno' })
    expect(registrationCta(event(), undefined, NOW)).toEqual({ kind: 'ninguno' })
  })
})
