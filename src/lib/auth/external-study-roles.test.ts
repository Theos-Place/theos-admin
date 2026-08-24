// Registrar A MANO un estudio en el expediente de alguien (el que lo llevó por
// fuera de Theos) es la escritura más delicada del módulo: un estudio
// registrado cuenta como PRERREQUISITO, así que quien puede escribirlo puede
// habilitar a cualquier persona para cualquier estudio posterior.
//
// Dos cosas que este test fija, y las dos estaban mal el 2026-08-24:
//  1. El botón se mostraba a CUALQUIER sesión —incluido el rol base 'miembro'—
//     y al enviarlo el API respondía 403 con un error genérico. La UI y el API
//     tienen que decidir con la MISMA lista.
//  2. El API permitía cinco roles (editor_perfiles, direccion, encargado_staff,
//     coordinador_estudios, admin). Se acotó a admin + coordinador de estudios.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { EXTERNAL_STUDY_ROLES, STUDY_ADMIN_ROLES } from './roles'

const RUTA = 'src/app/api/members/[id]/studies/route.ts'
// El botón vive en su propio componente desde el 2026-08-24, dentro del tab de
// Administración (antes estaba suelto en Participación).
const BOTON = 'src/components/studies/AddExternalStudyButton.tsx'
const TAB_ADMIN = 'src/app/(admin)/miembros/[id]/_components/MemberAdminTab.tsx'
const TAB_PARTICIPACION = 'src/app/(admin)/miembros/[id]/_components/MemberParticipationTab.tsx'

describe('quién puede registrar un estudio a mano', () => {
  it('solo admin y coordinador de estudios', () => {
    expect([...EXTERNAL_STUDY_ROLES].sort()).toEqual(['admin', 'coordinador_estudios'])
  })

  it('es MÁS restrictivo que administrar estudios', () => {
    // direccion y coordinador_dirigentes administran estudios pero NO registran
    // a mano. Si algún día se igualan, que sea una decisión, no un descuido.
    const fuera = STUDY_ADMIN_ROLES.filter(r => !EXTERNAL_STUDY_ROLES.includes(r))
    expect(fuera.sort()).toEqual(['coordinador_dirigentes', 'direccion'])
  })
})

describe('la UI y el API deciden con la misma lista', () => {
  it('el API usa la constante, no roles sueltos', () => {
    const txt = readFileSync(RUTA, 'utf8')
    expect(txt).toContain('requireRoles(...EXTERNAL_STUDY_ROLES)')
    // El guard viejo, escrito a mano, no puede volver.
    expect(txt).not.toMatch(/requireRoles\(\s*'/)
  })

  it('el botón se gatea a sí mismo con la misma constante', () => {
    const txt = readFileSync(BOTON, 'utf8')
    expect(txt).toContain('hasRole(...EXTERNAL_STUDY_ROLES)')
    // Devuelve null si no corresponde: el gate no puede quedar solo en quien lo
    // usa, porque el próximo lugar que lo monte se olvidaría de ponerlo.
    expect(txt).toMatch(/if \(!loaded \|\| !hasRole\(\.\.\.EXTERNAL_STUDY_ROLES\)\) return null/)
  })

  it('vive en el tab de Administración, no en Participación', () => {
    expect(readFileSync(TAB_ADMIN, 'utf8')).toContain('<AddExternalStudyButton')
    // En Participación quedó el historial, sin el botón ni su prop.
    expect(readFileSync(TAB_PARTICIPACION, 'utf8')).not.toContain('AddExternalStudyButton')
  })
})
