import { describe, it, expect } from 'vitest'
import { resolveRefundScope, scopeToRefundFilters } from './refunds-scope'

describe('resolveRefundScope', () => {
  it('finanzas, dirección y admin ven todo y resuelven', () => {
    for (const rol of ['finanzas', 'direccion', 'admin']) {
      const s = resolveRefundScope({ roles: [rol] })
      expect(s.access).toBe('all')
      expect(s.canResolve).toBe(true)
    }
  })

  it('coordinación de estudios ve las de un plan, pero NO resuelve', () => {
    const s = resolveRefundScope({ roles: ['coordinador_estudios'] })
    expect(s.access).toBe('studies')
    expect(s.canResolve).toBe(false)
  })

  // El test que pide la spec: el encargado del evento ve SOLO las de su evento.
  it('el encargado de evento ve solo sus eventos, y no resuelve', () => {
    const s = resolveRefundScope({ roles: ['miembro'], managedEventIds: ['e1', 'e2'] })
    expect(s.access).toBe('events')
    expect(s.canResolve).toBe(false)
    if (s.access === 'events') expect(s.eventIds).toEqual(['e1', 'e2'])
  })

  it('deduplica los eventos a cargo', () => {
    const s = resolveRefundScope({ roles: [], managedEventIds: ['e1', 'e1', 'e2'] })
    if (s.access === 'events') expect(s.eventIds).toEqual(['e1', 'e2'])
  })

  it('sin rol ni eventos a cargo, sin acceso', () => {
    expect(resolveRefundScope({ roles: [] }).access).toBe('none')
    expect(resolveRefundScope({ roles: ['miembro'], managedEventIds: [] }).access).toBe('none')
  })

  // Finanzas gana: no se degrada por ser también encargado de un evento.
  it('finanzas que además maneja un evento sigue viendo todo', () => {
    const s = resolveRefundScope({ roles: ['finanzas'], managedEventIds: ['e1'] })
    expect(s.access).toBe('all')
  })

  it('estudios gana sobre eventos (alcance más amplio de los dos acotados)', () => {
    const s = resolveRefundScope({ roles: ['coordinador_estudios'], managedEventIds: ['e1'] })
    expect(s.access).toBe('studies')
  })
})

describe('scopeToRefundFilters', () => {
  it('traduce el alcance a filtros de la query', () => {
    expect(scopeToRefundFilters({ access: 'all', canResolve: true })).toEqual({})
    expect(scopeToRefundFilters({ access: 'studies', canResolve: false })).toEqual({ onlyStudyKinds: true })
    expect(scopeToRefundFilters({ access: 'events', eventIds: ['e1'], canResolve: false }))
      .toEqual({ onlyEventIds: ['e1'] })
    expect(scopeToRefundFilters({ access: 'none', canResolve: false })).toEqual({})
  })
})
