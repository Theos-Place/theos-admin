// /matricula es el AUTOSERVICIO: es donde una persona se inscribe a sí misma en
// un estudio. Tiene que estar abierta a CUALQUIER sesión.
//
// El bug que esto fija (2026-08-25): la ruta mapeaba al módulo 'estudios' en el
// guard del layout, así que 12 de los 21 roles la tenían cerrada — finanzas,
// comunicaciones, encargado_staff, lider_comite, forms, becas, reportes… 88
// personas reales no podían matricularse por tener un rol de staff que no es de
// estudios, siendo que también son miembros.
//
// Por qué no se notó antes: el rol base 'miembro' SÍ pasa el chequeo (tiene
// estudios con alcance 'own'), así que la mayoría del padrón nunca lo vio. Solo
// falla para quien tiene un rol explícito, que es justo el staff.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ROLES, hasModulePermission } from './roles'

const LAYOUT = readFileSync('src/app/(admin)/layout.tsx', 'utf8')
const SIDEBAR = readFileSync('src/components/layout/Sidebar.tsx', 'utf8')

describe('/matricula está abierta a cualquier sesión', () => {
  it('el guard del layout la deja pasar ANTES de mirar el módulo', () => {
    const i = LAYOUT.indexOf("pathname === '/matricula'")
    const j = LAYOUT.indexOf("if (!can(MODULE_BY_PREFIX[prefix], 'view'))")
    expect(i, 'falta la excepción de /matricula en el guard').toBeGreaterThan(-1)
    expect(j, 'no se encontró el chequeo de módulo').toBeGreaterThan(-1)
    // El orden importa: si la excepción quedara DESPUÉS del chequeo, no sirve.
    expect(i).toBeLessThan(j)
  })

  it('el ítem del menú no depende del módulo estudios', () => {
    const linea = SIDEBAR.split('\n').find(l => l.includes("href: '/matricula'"))
    expect(linea).toBeDefined()
    expect(linea, 'Matrícula volvió a depender de un módulo').toContain('module: null')
  })

  // La razón de fondo, en números: sin la excepción, estos roles quedaban afuera.
  it('hay roles sin el módulo estudios — por eso la excepción es necesaria', () => {
    const sinEstudios = ROLES.filter(r => !hasModulePermission([r.id], 'estudios', 'view'))
    expect(sinEstudios.length).toBeGreaterThan(0)
    // Un puñado de los que fallaban, nombrados para que se entienda el alcance.
    const ids = sinEstudios.map(r => r.id)
    for (const r of ['finanzas', 'comunicaciones', 'encargado_staff', 'lider_comite', 'forms']) {
      expect(ids, `${r} debería seguir sin el módulo estudios`).toContain(r)
    }
  })
})
