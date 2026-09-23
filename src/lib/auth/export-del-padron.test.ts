import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { hasModulePermission, moduleScope, ROLES } from '@/lib/auth/roles'
import type { RoleId } from '@/types/auth'

/**
 * PAR-4 · Quién puede exportar el padrón.
 *
 * DOS PUERTAS QUE TIENEN QUE DECIR LO MISMO: el botón de la pantalla
 * (`can('miembros','export')`) y el endpoint `GET /api/members/export`. Si solo
 * se esconde el botón, el endpoint sigue abierto — y el proxy excluye `/api`,
 * así que pegarle directo funciona.
 *
 * HALLAZGO AL HACER ESTE ÍTEM (2026-09-23): el endpoint NO mira la acción
 * `export`. Guarda por `view` con alcance `all`, y eso lo cumplen SIETE roles
 * que no tienen el permiso. O sea que hoy pueden bajarse las 24.000 fichas
 * —con cédula, correo y teléfono— por API, aunque no vean el botón. Medido en
 * el audit_log: nadie lo ha hecho (10 exportaciones, todas del 2026-07-29 y con
 * cuentas de prueba).
 *
 * Este test fija la lista de quién DEBE poder, para que la decisión sea
 * explícita y no un efecto colateral del alcance.
 */

/** Los que exportan el padrón, a propósito. `admin` va aparte: tiene todo. */
const PUEDEN_EXPORTAR: RoleId[] = ['direccion', 'editor_perfiles']

describe('exportar el padrón', () => {
  it('editor_perfiles puede, que es lo que PAR-4 pedía', () => {
    expect(hasModulePermission(['editor_perfiles'], 'miembros', 'export')).toBe(true)
  })

  it('y sigue viendo el padrón completo — exportar no le agrega alcance', () => {
    // El punto 3 del ítem: no puede bajarse campos que en pantalla no ve.
    // Como el alcance no cambia y las columnas de esa tabla no están gateadas
    // por permiso, exporta exactamente lo que ya tiene delante.
    expect(moduleScope(['editor_perfiles'], 'miembros')).toBe('all')
  })

  it('la lista de quién exporta es exactamente la decidida', () => {
    const conPermiso = ROLES
      .filter(r => r.id !== 'admin')
      .filter(r => hasModulePermission([r.id], 'miembros', 'export'))
      .map(r => r.id)
      .sort()
    expect(conPermiso).toEqual([...PUEDEN_EXPORTAR].sort())
  })

  it('un rol sin el módulo miembros no exporta', () => {
    for (const rol of ['miembro', 'dirigente', 'folletos'] as RoleId[]) {
      expect(hasModulePermission([rol], 'miembros', 'export'), rol).toBe(false)
    }
  })

  it('lider_comite no exporta: su alcance es su comité, no el padrón', () => {
    // SEC-1. El endpoint además exige alcance 'all', que este rol no tiene.
    expect(hasModulePermission(['lider_comite'], 'miembros', 'export')).toBe(false)
    expect(moduleScope(['lider_comite'], 'miembros')).not.toBe('all')
  })

  it('EL ENDPOINT EXIGE LA ACCIÓN, no solo el alcance', () => {
    /**
     * Esto era el agujero, cerrado el 2026-09-23: el endpoint guardaba solo por
     * alcance, y siete roles sin el permiso pasaban igual —incluido
     * solo_lectura—. Esconder un botón no es un permiso.
     *
     * El test lee el código del endpoint a propósito: la alternativa era
     * confiar en que alguien se acuerde, y de eso venimos.
     */
    const src = readFileSync('src/app/api/members/export/route.ts', 'utf8')
    expect(src).toContain("hasModulePermission(auth.ctx.roles, 'miembros', 'export')")
  })

  it('los siete que pasaban de más ya no pasan', () => {
    for (const rol of ['comunicaciones', 'coordinador_dirigentes', 'coordinador_estudios',
      'coordinador_servidores', 'encargado_staff', 'finanzas', 'solo_lectura'] as RoleId[]) {
      expect(hasModulePermission([rol], 'miembros', 'export'), rol).toBe(false)
    }
  })

  it('el endpoint sigue exigiendo alcance total (SEC-1)', () => {
    const src = readFileSync('src/app/api/members/export/route.ts', 'utf8')
    expect(src).toContain("moduleScope(auth.ctx.roles, 'miembros') !== 'all'")
  })
})
