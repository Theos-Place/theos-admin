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
const PANTALLA = 'src/app/(admin)/miembros/[id]/page.tsx'

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

  it('el botón usa la misma constante', () => {
    const txt = readFileSync(PANTALLA, 'utf8')
    expect(txt).toContain('hasRole(...EXTERNAL_STUDY_ROLES)')
  })

  it('el botón NO se pasa sin condición', () => {
    // `onAddStudy={() => ...}` suelto es exactamente el bug que había.
    const txt = readFileSync(PANTALLA, 'utf8')
    expect(txt).not.toMatch(/onAddStudy=\{\(\) =>/)
    expect(txt).toMatch(/onAddStudy=\{puedeAgregarEstudio \?/)
  })
})
