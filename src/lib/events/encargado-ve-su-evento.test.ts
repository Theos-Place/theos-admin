import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { canSeeEventManagementData, visibleEventTabs } from './detail-access'

/**
 * EVT-10 · Al encargado de un evento le llegan SUS inscripciones.
 *
 * EL BUG (reportado el 2026-10-13, después de arreglar que el evento
 * compartido apareciera en el calendario): la persona entraba al evento,
 * veía el tab «Inscripciones» y estaba vacío.
 *
 * LA CAUSA, y es el patrón que este repo ya conoce: LA MISMA REGLA
 * EVALUADA DISTINTO EN LOS DOS LADOS. `canSeeEventManagementData` recibe
 * `isManager`, y la PANTALLA se lo pasaba —por eso mostraba el tab— pero el
 * ENDPOINT armaba los permisos solo con los del módulo. A quien tiene un
 * evento a cargo sin tener el módulo —toda persona a la que se le
 * «comparte» un evento— el servidor le devolvía `registrations: []`.
 *
 * Resultado: el tab abría y parecía que nadie se había inscrito.
 */
const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const API = sinComentarios('src/app/api/events/[id]/route.ts')

describe('la regla pura ya contemplaba al encargado', () => {
  it('ser encargado alcanza para ver los datos de gestión', () => {
    expect(canSeeEventManagementData({
      canManage: false, canCheckin: false, canReport: false, isManager: true,
    })).toBe(true)
  })

  it('y para ver todos los tabs', () => {
    expect(visibleEventTabs({
      canManage: false, canCheckin: false, canReport: false, isManager: true,
    })).toContain('inscripciones')
  })

  it('sin nada de eso, no', () => {
    expect(canSeeEventManagementData({
      canManage: false, canCheckin: false, canReport: false, isManager: false,
    })).toBe(false)
  })
})

describe('y el ENDPOINT también se lo pregunta', () => {
  it('arma los permisos con isManager, no solo con el módulo', () => {
    // Era la mitad que faltaba: la pantalla lo sabía y el servidor no.
    expect(API).toMatch(/isManager:[\s\S]{0,200}isEventManager\(id, auth\.ctx\.memberId\)/)
  })

  it('el recorte del payload sigue existiendo para quien no gestiona', () => {
    // El arreglo no puede abrirle los nombres de los inscritos a cualquiera.
    expect(API).toContain('registrations: [], checkins: [], volunteers: []')
    expect(API).toContain('if (!canSeeEventManagementData(perms))')
  })
})
