import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { hasModulePermission, moduleScope, hasManagementRole, ROLES } from '@/lib/auth/roles'
import type { RoleId } from '@/types/auth'

/**
 * PAD-1 · Ninguna pantalla le pide el PADRÓN a un rol que no lo tiene.
 *
 * `GET /api/members` exige alcance TOTAL sobre el módulo miembros. Doce roles de
 * gestión no lo tienen. Y como el patrón de fetch en toda la app es
 * `r.ok ? r.json() : { members: [] }`, el 403 no se ve: el buscador devuelve
 * VACÍO y quien lo usa concluye que la persona no existe.
 *
 * Esto ya se arregló CINCO veces por separado —el QR del check-in, el modal de
 * familia, el buscador de familiar, el de candidatos a servidor y el Topbar—
 * porque cada pantalla lo descubría sola cuando alguien lo reportaba. Este test
 * es para que la sexta la encuentre CI.
 *
 * La lista blanca es corta y explícita: pantallas cuyos usuarios SÍ tienen el
 * padrón y que necesitan campos que el lookup mínimo no trae.
 */
const PERMITIDOS = [
  // El padrón mismo y el alta: son la pantalla del módulo miembros.
  'src/app/(admin)/miembros/[id]/page.tsx',
  'src/app/(admin)/miembros/nuevo/page.tsx',
  // Comunicaciones tiene el módulo miembros y arma audiencias con sus filtros.
  'src/components/communications/RecipientSelector.tsx',
  // Alta de empleados: usa la ocupación, que el lookup no devuelve; la pantalla
  // es de direccion/encargado_staff.
  'src/app/(admin)/empleados/nuevo/_components/StepPersonSearch.tsx',
]

describe('PAD-1 · el padrón solo se pide donde corresponde', () => {
  it('doce roles de gestión NO pueden usar el padrón pero SÍ el lookup', () => {
    const todos = (ROLES as ReadonlyArray<{ id: RoleId }>).map(r => r.id)
    const acotados = todos.filter(r => moduleScope([r], 'miembros') !== 'all' && hasManagementRole([r]))
    // Si este número baja, alguien le abrió el padrón a un rol: revisar que sea
    // a propósito y no un efecto colateral.
    expect(acotados.length).toBeGreaterThanOrEqual(12)
    expect(acotados).toContain('lider_comite')
    expect(acotados).toContain('encargado_eventos')
    expect(acotados).toContain('forms')
  })

  it('el buscador del Topbar se le muestra a lider_comite, así que NO puede usar el padrón', () => {
    // El gate de la UI es view && scope !== 'own'; el de la API es scope === 'all'.
    // lider_comite cae en el medio: ve la caja y recibe 403.
    const veLaCaja = hasModulePermission(['lider_comite'], 'miembros', 'view')
      && moduleScope(['lider_comite'], 'miembros') !== 'own'
    expect(veLaCaja).toBe(true)
    expect(moduleScope(['lider_comite'], 'miembros')).not.toBe('all')
    const topbar = execSync('cat "src/components/layout/Topbar.tsx"', { encoding: 'utf8' })
    expect(topbar).toContain('/api/members/lookup?search=')
  })

  it('el default de MemberCombobox es el lookup, no el padrón', () => {
    const src = execSync('cat "src/components/shared/MemberCombobox.tsx"', { encoding: 'utf8' })
    expect(src).toContain('searchUrl = MEMBER_LOOKUP_URL')
  })

  it('nadie más usa el padrón para buscar, fuera de la lista blanca', () => {
    // Dos formas de llegar al padrón: armar la URL a mano, o pasarle
    // searchUrl="/api/members" al combobox (que construye la query adentro).
    const directo = execSync('grep -rln "api/members?search=" src/ || true', { encoding: 'utf8' })
    const viaCombobox = execSync(`grep -rln 'searchUrl="/api/members"' src/ || true`, { encoding: 'utf8' })
    const archivos = [...new Set([...directo.split('\n'), ...viaCombobox.split('\n')])]
      .filter(Boolean)
      .filter(f => !f.endsWith('.test.ts'))
    expect(archivos.sort()).toEqual([...PERMITIDOS].sort())
  })
})
