import { describe, it, expect } from 'vitest'
import { ROLES, hasModulePermission } from '@/lib/auth/roles'

/**
 * Los nombres que la gente lee, y la distinción entre `id` y `name`.
 *
 * Renombres del 2026-10-01: «Encargado de Staff» pasó a «Empleados» y
 * «Encargado de Eventos» a «Eventos». Solo cambió `name`. Los `id` se quedan
 * porque están escritos en tres lugares más —las filas de `member_roles`, el
 * CHECK que repite la lista y los helpers de RLS que la repiten otra vez— y
 * moverlos los tres a la vez es un riesgo que no compra nada: el id no se ve.
 */
describe('nombres de rol', () => {
  const nombre = (id: string) => ROLES.find(r => r.id === id)?.name

  it('encargado_staff se llama «Empleados»', () => {
    expect(nombre('encargado_staff')).toBe('Empleados')
  })

  it('encargado_eventos se llama «Eventos»', () => {
    expect(nombre('encargado_eventos')).toBe('Eventos')
  })

  it('los id NO cambiaron: son los que están en la base', () => {
    // Si alguien «termina» el renombre tocando el id, esto avisa antes de que
    // la migración falte y el rol desaparezca de las fichas que lo tienen.
    const ids = ROLES.map(r => r.id)
    expect(ids).toContain('encargado_staff')
    expect(ids).toContain('encargado_eventos')
  })

  it('ningún nombre se repite', () => {
    // Dos roles con el mismo nombre son indistinguibles en el selector, y el
    // que asigna no tiene cómo saber cuál escogió.
    const nombres = ROLES.map(r => r.name)
    expect(nombres.length).toBe(new Set(nombres).size)
  })
})

describe('«Empleados» puede todo lo de las páginas de empleados', () => {
  for (const accion of ['view', 'create', 'edit', 'delete', 'export'] as const) {
    it(`puede ${accion}`, () => {
      expect(hasModulePermission(['encargado_staff'], 'empleados', accion)).toBe(true)
    })
  }

  it('y completar el permiso no fue repartirlo', () => {
    /**
     * El contrapeso: son salarios y documentos de personal.
     *
     * `solo_lectura` aparece y NO es un descuido: lleva un comodín
     * `{ module: 'all' }` que un grep por 'empleados' no encuentra —ya me
     * engañó una vez en este mismo archivo—. Puede LISTAR empleados, no ver
     * salarios: `/api/employees/[id]/salary` guarda con
     * `requireRoles('direccion','encargado_staff')`, que es por rol y no por
     * módulo. Queda escrito acá para que la próxima vez se sepa sin medirlo.
     */
    const otros = ROLES
      .filter(r => !['encargado_staff', 'direccion', 'admin'].includes(r.id))
      .filter(r => hasModulePermission([r.id], 'empleados', 'view'))
      .map(r => r.id)
    expect(otros).toEqual(['solo_lectura'])
  })

  it('y nadie nuevo puede ESCRIBIR en empleados', () => {
    // Acá el comodín de solo_lectura no alcanza: es de solo lectura.
    const escriben = ROLES
      .filter(r => r.id !== 'admin')
      .filter(r => hasModulePermission([r.id], 'empleados', 'edit'))
      .map(r => r.id).sort()
    expect(escriben).toEqual(['direccion', 'encargado_staff'])
  })
})
