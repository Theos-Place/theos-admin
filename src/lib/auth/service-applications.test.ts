import { describe, it, expect } from 'vitest'
import { canSeeServiceApplications, SERVICE_APPLICATIONS_ROLES } from './service-applications'

describe('canSeeServiceApplications (2026-07-30)', () => {
  it('solo coordinador de servidores y admin', () => {
    expect(SERVICE_APPLICATIONS_ROLES).toEqual(['coordinador_servidores', 'admin'])
    expect(canSeeServiceApplications(['coordinador_servidores'])).toBe(true)
    expect(canSeeServiceApplications(['admin'])).toBe(true)
  })

  it('el resto del staff de servidores queda fuera de la bandeja', () => {
    expect(canSeeServiceApplications(['encargado_staff'])).toBe(false)
    expect(canSeeServiceApplications(['direccion'])).toBe(false)
    expect(canSeeServiceApplications(['lider_comite'])).toBe(false)
    expect(canSeeServiceApplications(['miembro'])).toBe(false)
    expect(canSeeServiceApplications([])).toBe(false)
  })

  it('multi-rol: alcanza con tener uno de los dos', () => {
    expect(canSeeServiceApplications(['lider_comite', 'coordinador_servidores'])).toBe(true)
  })
})
