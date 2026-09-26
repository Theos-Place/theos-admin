import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { puedeSolicitarParaCualquierComite, SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import type { RoleId } from '@/types/auth'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const PAGINA = 'src/app/(admin)/servidores/vacantes/solicitar/page.tsx'
const RUTA = 'src/app/api/servers/vacancies/request/route.ts'

describe('SRV-11 · «Importar vacantes» se eliminó entero', () => {
  it('no queda ni la pantalla, ni el API, ni la plantilla', () => {
    for (const ruta of [
      'src/app/(admin)/servidores/admin/importar-vacantes',
      'src/app/api/servers/vacancies/import',
      'src/app/api/servers/vacancies/import-template',
      'src/lib/servers/plantilla-de-vacantes.ts',
    ]) {
      expect(existsSync(ruta), ruta).toBe(false)
    }
  })

  it('ni un enlace colgando que lleve a un 404', () => {
    for (const ruta of [
      'src/app/(admin)/servidores/admin/page.tsx',
      'src/app/(admin)/servidores/vacantes/page.tsx',
    ]) {
      expect(sinComentarios(ruta), ruta).not.toContain('importar-vacantes')
    }
  })
})

describe('SRV-11 · la solicitud es solo cantidades', () => {
  it('la pantalla ya no pide los detalles de la vacante', () => {
    // Estaban en la ficha del puesto y el líder los reescribía de memoria cada
    // mes: quedaban tres versiones del mismo horario.
    const src = sinComentarios(PAGINA)
    for (const campo of ['setSchedule', 'setCommitment', 'setExpiresAt', 'setFeatured']) {
      expect(src, campo).not.toContain(campo)
    }
  })

  it('y se consultan en un modal de SOLO LECTURA', () => {
    const src = sinComentarios(PAGINA)
    expect(src).toContain('Ver detalles')
    const modal = src.slice(src.indexOf('detalle-puesto-title'))
    // Ni un input ni un guardado: dos lugares donde cambiar el mismo dato son
    // dos versiones del dato.
    expect(modal).not.toContain('<input')
    expect(modal).not.toContain('onChange')
  })

  it('el body que manda es comité + items, nada más', () => {
    expect(sinComentarios(PAGINA))
      .toContain('JSON.stringify({ committee_id: committeeId, items })')
  })
})

describe('SRV-11 · quién puede solicitar para cualquier comité', () => {
  const roles = (...r: string[]) => r as RoleId[]

  it('los administrativos globales, como siempre', () => {
    expect(puedeSolicitarParaCualquierComite(roles('coordinador_servidores'))).toBe(true)
    expect(puedeSolicitarParaCualquierComite(roles('admin'))).toBe(true)
  })

  it('y el rol nuevo: llena la solicitud en lugar del líder', () => {
    expect(puedeSolicitarParaCualquierComite(roles('solicitudes_puestos'))).toBe(true)
  })

  it('pero el rol nuevo NO es un admin de servicio', () => {
    // Si se hubiera metido en SERVICE_ADMIN_ROLES para ahorrarse la función,
    // se habría llevado de regalo la exención de la ventana y la
    // auto-aprobación. Su solicitud tiene que quedar pendiente, como la de
    // cualquier líder.
    expect(SERVICE_ADMIN_ROLES).not.toContain('solicitudes_puestos')
  })

  it('un miembro cualquiera, no', () => {
    expect(puedeSolicitarParaCualquierComite(roles('miembro'))).toBe(false)
    expect(puedeSolicitarParaCualquierComite(roles('lider_comite'))).toBe(false)
  })

  it('la exención de la ventana en la pantalla sale de los ROLES, no del alcance', () => {
    // La trampa: `solicitudes_puestos` ve todos los comités, así que con la
    // regla vieja (`!scope.all`) se habría saltado la ventana.
    const src = sinComentarios(PAGINA)
    expect(src).toContain('const isLeader = !hasRole(...SERVICE_ADMIN_ROLES)')
    expect(src).not.toContain('const isLeader = !!scope && !scope.all')
  })

  it('y el servidor la aplica con el MISMO criterio', () => {
    const src = sinComentarios(RUTA)
    expect(src).toMatch(/isGlobalServiceAdmin\(auth\.ctx\.roles\)/)
    expect(src).toMatch(/!globalAdmin && !isVacancyRequestWindowOpen\(\)/)
  })
})
