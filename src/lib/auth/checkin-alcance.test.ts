import { describe, it, expect } from 'vitest'
import { hasModulePermission, hasManagementRole, EVENT_CHECKIN_ROLES } from '@/lib/auth/roles'
import type { RoleId } from '@/types/auth'

/**
 * El rol de check-in gana capacidades QUIRÚRGICAS dentro del contexto del
 * evento, y NUNCA el módulo de miembros. Estos tests fijan las dos mitades:
 * si alguien le abre el padrón por error, acá se cae.
 */
describe('alcance de encargado_eventos', () => {
  const ROL: RoleId[] = ['encargado_eventos']

  it('NO tiene el módulo de miembros — ni ver, ni crear, ni editar', () => {
    for (const accion of ['view', 'create', 'edit', 'delete', 'export'] as const) {
      expect(hasModulePermission(ROL, 'miembros', accion)).toBe(false)
    }
  })

  it('sí pasa el gate del lookup mínimo, que es por dónde debe buscar y escanear', () => {
    // El QR y la búsqueda por nombre van los dos por /api/members/lookup, cuyo
    // gate es hasManagementRole. Si esto se cae, la fila del evento se queda sin
    // ninguno de los dos caminos.
    expect(hasManagementRole(ROL)).toBe(true)
  })

  it('todos los roles de check-in pasan ese gate', () => {
    for (const r of EVENT_CHECKIN_ROLES) {
      expect(hasManagementRole([r])).toBe(true)
    }
  })

  it('un miembro raso NO pasa el gate del lookup', () => {
    expect(hasManagementRole(['miembro'])).toBe(false)
  })
})
