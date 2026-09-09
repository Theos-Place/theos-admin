import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { hasModulePermission, ROLES } from '@/lib/auth/roles'
import type { RoleId } from '@/types/auth'

/**
 * Quién puede tocar una familia. Decisión 2026-09-10: EXACTAMENTE los mismos que
 * pueden editar perfiles, ni uno más. Un miembro básico NO edita su propia
 * familia — vincular o desvincular cambia quién puede ver y pagar por quién
 * (family_member_ids del autoservicio), así que no es un dato personal más.
 *
 * El test compara el gate de la ruta contra la matriz de permisos: si alguien
 * agrega un rol a FAMILY_EDIT_ROLES sin dárselo también en miembros:edit, o al
 * revés, se cae acá.
 */
const RUTA = readFileSync('src/app/api/members/[id]/family/route.ts', 'utf8')

describe('permisos sobre la familia', () => {
  const editanPerfiles = (ROLES as ReadonlyArray<{ id: RoleId }>)
    .map(r => r.id)
    .filter(r => hasModulePermission([r], 'miembros', 'edit'))

  it('los que editan perfiles son editor_perfiles, direccion y admin', () => {
    expect(editanPerfiles.sort()).toEqual(['admin', 'direccion', 'editor_perfiles'])
  })

  it('el gate de la ruta lista los mismos, menos admin (que pasa siempre)', () => {
    const m = RUTA.match(/const FAMILY_EDIT_ROLES = \[([^\]]*)\]/)
    expect(m).toBeTruthy()
    const declarados = [...m![1].matchAll(/'([a-z_]+)'/g)].map(x => x[1]).sort()
    expect(declarados).toEqual(editanPerfiles.filter(r => r !== 'admin').sort())
  })

  it('las tres escrituras están gateadas; solo la lectura queda abierta', () => {
    // GET es más laxo a propósito: cada quien ve su familia, y quien registra
    // asistencia ve la de cualquiera para el check-in en familia.
    for (const verbo of ['POST', 'PATCH', 'DELETE']) {
      const i = RUTA.indexOf(`export async function ${verbo}(`)
      expect(i, `falta ${verbo}`).toBeGreaterThan(-1)
      const cuerpo = RUTA.slice(i, i + 400)
      expect(cuerpo, `${verbo} sin gate`).toContain('requireRoles(...FAMILY_EDIT_ROLES)')
    }
  })

  it('un miembro básico no edita familias', () => {
    expect(hasModulePermission(['miembro'], 'miembros', 'edit')).toBe(false)
  })
})
