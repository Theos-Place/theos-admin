// El rol MÍNIMO de cualquier persona con ficha. Verificado en navegador el
// 2026-08-24 con una cuenta de roles vacíos: aterriza en su perfil, ve el tab
// de Familia, abre el perfil de su pariente y entra a /estudios/plan; el padrón
// le queda denegado.
//
// Por qué existe este archivo: el default vivía COPIADO en getAuthContext() y en
// /api/auth/me, sin ningún test. Los dos tienen que dar el mismo resultado — si
// el servidor cree que no hay rol y el cliente cree que sí, la pantalla se
// deniega con datos que sí llegaron. Acá se fija el invariante y se verifica que
// no vuelva a haber una segunda copia.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { withBaseRole, hasModulePermission, moduleScope, hasManagementRole } from './roles'
import { landsOnProfile } from './home-route'

describe('withBaseRole', () => {
  it('sin roles da miembro', () => {
    expect(withBaseRole([])).toEqual(['miembro'])
    expect(withBaseRole(null)).toEqual(['miembro'])
    expect(withBaseRole(undefined)).toEqual(['miembro'])
  })

  it('con roles explícitos NO agrega miembro', () => {
    // Importa: si agregara 'miembro' a todos, hasManagementRole seguiría bien
    // (lo excluye), pero landsOnProfile NO — un admin caería en su perfil.
    expect(withBaseRole(['admin'])).toEqual(['admin'])
    expect(withBaseRole(['dirigente', 'finanzas'])).toEqual(['dirigente', 'finanzas'])
  })

  it('no muta el arreglo que recibe', () => {
    const entrada: never[] = []
    withBaseRole(entrada)
    expect(entrada).toEqual([])
  })
})

describe('lo que el rol base habilita, y lo que no', () => {
  const base = withBaseRole([])

  it('ve su propio perfil, con alcance own', () => {
    expect(hasModulePermission(base, 'miembros', 'view')).toBe(true)
    expect(moduleScope(base, 'miembros')).toBe('own')
  })

  it('NO ve el padrón: eso exige alcance all', () => {
    expect(moduleScope(base, 'miembros')).not.toBe('all')
  })

  it('no puede editar ni exportar', () => {
    for (const accion of ['create', 'edit', 'delete', 'export']) {
      expect(hasModulePermission(base, 'miembros', accion)).toBe(false)
    }
  })

  it('aterriza en su perfil, no en el dashboard', () => {
    expect(landsOnProfile(base)).toBe(true)
  })

  it('no cuenta como rol de gestión', () => {
    expect(hasManagementRole(base)).toBe(false)
  })
})

// El invariante se rompe si alguien vuelve a escribir el default a mano en vez
// de llamar a withBaseRole. Esto lo caza.
describe('el default no está duplicado', () => {
  it("nadie escribe el fallback ['miembro'] a mano", () => {
    const archivos = execSync(
      "grep -rl \"'miembro'\" src --include='*.ts' --include='*.tsx'",
      { encoding: 'utf8' },
    ).trim().split('\n').filter(Boolean)
    const copias: string[] = []
    for (const f of archivos) {
      // roles.ts es DONDE VIVE el default (dentro de withBaseRole): es la
      // única copia legítima. Este test busca las copias de más.
      if (f.endsWith('base-role.test.ts') || f.endsWith('auth/roles.ts')) continue
      const txt = readFileSync(f, 'utf8')
      // El patrón exacto que había duplicado: `… ? … : ['miembro']`
      for (const m of txt.matchAll(/\?[^\n]*:\s*\[\s*'miembro'\s*\]/g)) {
        copias.push(`${f}:${txt.slice(0, m.index!).split('\n').length}`)
      }
    }
    expect(copias).toEqual([])
  })

  it('withBaseRole es lo que usan los dos lectores de roles', () => {
    for (const f of ['src/lib/auth/guard.ts', 'src/app/api/auth/me/route.ts']) {
      expect(readFileSync(f, 'utf8')).toContain('withBaseRole(')
    }
  })
})
