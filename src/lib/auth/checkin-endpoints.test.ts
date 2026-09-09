import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { EVENT_CHECKIN_ROLES } from '@/lib/auth/roles'
import {
  CAMPOS_ALTA_CHECKIN, CAMPOS_CORRECCION_CHECKIN,
} from '@/lib/members/alta-desde-checkin'

/**
 * Los endpoints acotados del check-in tienen que seguir siendo acotados. Estos
 * tests leen el archivo y fijan las tres propiedades que importan: quién entra,
 * qué campos pasan, y que el padrón general NO se le abrió al rol.
 *
 * Se lee el fuente en vez de invocar el handler porque el handler exige sesión
 * de Supabase; lo que se quiere blindar acá es la DECLARACIÓN del permiso, que
 * es justo lo que alguien podría aflojar sin darse cuenta.
 */
const ALTA = readFileSync('src/app/api/events/[id]/members/route.ts', 'utf8')
const CORRECCION = readFileSync('src/app/api/events/[id]/members/[memberId]/route.ts', 'utf8')
const PADRON = readFileSync('src/app/api/members/route.ts', 'utf8')
const PERFIL = readFileSync('src/app/api/members/[id]/route.ts', 'utf8')

describe('alta desde el check-in', () => {
  it('está gateada a EVENT_CHECKIN_ROLES', () => {
    expect(ALTA).toContain('requireRoles(...EVENT_CHECKIN_ROLES)')
  })

  it('construye el payload SOLO con la lista de campos permitidos', () => {
    expect(ALTA).toContain('CAMPOS_ALTA_CHECKIN')
    expect(ALTA).toContain('camposRechazados')
  })

  it('responde 409 con la ficha existente, para poder usarla en vez de duplicar', () => {
    expect(ALTA).toContain("code: 'duplicate'")
    expect(ALTA).toContain('findMemberByCedulaOrEmail')
  })

  it('no exige documento: el alta pasa sin cédula', () => {
    // Si alguien vuelve a poner .min(1) sobre cedula, la fila se traba de nuevo.
    expect(ALTA).toMatch(/cedula:\s*z\.string\(\)\.trim\(\)\.nullish\(\)/)
  })
})

describe('corrección desde el check-in', () => {
  it('está gateada a EVENT_CHECKIN_ROLES', () => {
    expect(CORRECCION).toContain('requireRoles(...EVENT_CHECKIN_ROLES)')
  })

  it('solo documento y teléfono', () => {
    expect(CORRECCION).toContain('CAMPOS_CORRECCION_CHECKIN')
    expect([...CAMPOS_CORRECCION_CHECKIN]).not.toContain('email')
  })

  it('dedupea antes de guardar', () => {
    expect(CORRECCION).toContain("code: 'duplicate'")
  })
})

describe('el padrón general NO se abrió', () => {
  it('el POST de /api/members sigue exigiendo roles de padrón, sin encargado_eventos', () => {
    const linea = PADRON.split('\n').find(l => l.includes("requireRoles('editor_perfiles'"))
    expect(linea).toBeTruthy()
    expect(linea).not.toContain('encargado_eventos')
    expect(linea).not.toContain('EVENT_CHECKIN_ROLES')
  })

  it('el GET del padrón sigue exigiendo el módulo miembros con alcance total', () => {
    expect(PADRON).toContain("requireModuleView('miembros', { beyondOwn: true })")
    expect(PADRON).toContain("moduleScope(auth.ctx.roles, 'miembros') !== 'all'")
  })

  it('el PATCH del perfil completo sigue sin encargado_eventos', () => {
    const linea = PERFIL.split('\n').find(l => l.includes('const STAFF_ROLES'))
    expect(linea).toBeTruthy()
    expect(linea).not.toContain('encargado_eventos')
  })

  it('los roles de check-in son los tres esperados y nada más', () => {
    expect([...EVENT_CHECKIN_ROLES].sort()).toEqual(['admin', 'direccion', 'encargado_eventos'])
  })

  it('el alta acotada no puede tocar campos de gestión', () => {
    for (const p of ['is_active', 'is_donor', 'is_system']) {
      expect(CAMPOS_ALTA_CHECKIN as readonly string[]).not.toContain(p)
    }
  })
})
