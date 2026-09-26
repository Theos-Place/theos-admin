import { describe, it, expect } from 'vitest'
import {
  canSeeServiceApplications, SERVICE_APPLICATIONS_ROLES, GESTIONAN_APLICACIONES,
} from './service-applications'

/**
 * La bandeja nació acotada a coordinador de servidores y admin (2026-07-30).
 * SRV-14 (2026-09-25) la abre a dos más y este test se actualizó A PROPÓSITO:
 * el trabajo de revisar, mandar al encargado y dar seguimiento lo hacen dos
 * puestos del comité de servidores, que ahora tienen su propio rol en vez de
 * tener que ser coordinadores de todo. `direccion` entra como VISTA.
 *
 * Lo que NO cambió y este archivo sigue cuidando: `encargado_staff` y
 * `lider_comite` no ven la bandeja completa — resuelven una aplicación puntual
 * desde el detalle de la vacante, que es otra pantalla.
 */
describe('quién VE la bandeja de aplicaciones', () => {
  it('los cuatro de la lista', () => {
    expect(SERVICE_APPLICATIONS_ROLES)
      .toEqual(['coordinador_servidores', 'admin', 'aplicaciones_servicio', 'direccion'])
    for (const r of SERVICE_APPLICATIONS_ROLES) {
      expect(canSeeServiceApplications([r]), r).toBe(true)
    }
  })

  it('el staff y los líderes de comité siguen fuera de la bandeja completa', () => {
    expect(canSeeServiceApplications(['encargado_staff'])).toBe(false)
    expect(canSeeServiceApplications(['lider_comite'])).toBe(false)
    expect(canSeeServiceApplications(['miembro'])).toBe(false)
    expect(canSeeServiceApplications([])).toBe(false)
  })

  it('multi-rol: alcanza con tener uno', () => {
    expect(canSeeServiceApplications(['lider_comite', 'coordinador_servidores'])).toBe(true)
  })
})

describe('VER y GESTIONAR no son la misma lista', () => {
  it('dirección VE pero no cambia estados', () => {
    // Aceptar da de alta a alguien como servidor y le sincroniza permisos. El
    // acceso de dirección es de lectura (mapa de accesos de la Fase 24).
    expect(SERVICE_APPLICATIONS_ROLES).toContain('direccion')
    expect(GESTIONAN_APLICACIONES).not.toContain('direccion')
  })

  it('el staff y el líder GESTIONAN aunque no vean la bandeja', () => {
    // Resuelven la aplicación puntual desde el detalle de la vacante: es el
    // flujo que ya existía y SRV-14 no lo toca.
    expect(GESTIONAN_APLICACIONES).toContain('encargado_staff')
    expect(GESTIONAN_APLICACIONES).toContain('lider_comite')
    expect(SERVICE_APPLICATIONS_ROLES).not.toContain('encargado_staff')
  })

  it('el rol nuevo hace las dos cosas: es quien hace el trabajo', () => {
    expect(SERVICE_APPLICATIONS_ROLES).toContain('aplicaciones_servicio')
    expect(GESTIONAN_APLICACIONES).toContain('aplicaciones_servicio')
  })
})
