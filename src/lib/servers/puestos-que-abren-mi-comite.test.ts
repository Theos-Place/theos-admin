import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { abreMiComite, ANFITRIONES_QUE_ABREN_MI_COMITE } from './puestos-que-abren-mi-comite'
import { esPuestoDeEncargado } from './encargados'
import type { PositionContext } from './position-roles'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

/** Un puesto en un comité de sede, que es donde viven los anfitriones. */
const enSede = (title: string, areaName = 'Sede Pedregal Domingos'): PositionContext =>
  ({ title, areaName, areaType: 'committee', parentAreaName: 'Sedes' })

const enComite = (title: string, areaName = 'Comité Servidores'): PositionContext =>
  ({ title, areaName, areaType: 'committee', parentAreaName: 'Área Espiritual' })

describe('SRV-16 · el anfitrión abre la pantalla de su sede', () => {
  it('«Anfitrión», que es el título que EXISTE hoy', () => {
    // Medido el 2026-09-30: 10 puestos, uno por sede, 21 personas activas.
    expect(abreMiComite(enSede('Anfitrión'))).toBe(true)
  })

  it('y «Anfitrión 1», que todavía no existe', () => {
    // El pedido lo llamaba así. La regla se escribe para los dos porque el
    // comité puede crearlo o renombrar el actual, y entonces nadie tendría que
    // acordarse de volver acá.
    expect(abreMiComite(enSede('Anfitrión 1'))).toBe(true)
    expect(abreMiComite(enSede('Anfitrion 1'))).toBe(true)
  })

  it('los dos títulos están declarados y son solo esos', () => {
    expect([...ANFITRIONES_QUE_ABREN_MI_COMITE].sort()).toEqual(['anfitrion', 'anfitrion 1'])
  })

  it('un anfitrión FUERA de un comité de sede no abre nada', () => {
    // Si mañana alguien crea un «Anfitrión» para un evento puntual o un comité
    // administrativo, no se lleva consigo los compromisos de esa gente.
    expect(abreMiComite(enComite('Anfitrión'))).toBe(false)
    expect(abreMiComite({ ...enSede('Anfitrión'), areaType: 'area' })).toBe(false)
  })

  it('los puestos PARECIDOS no entran', () => {
    for (const t of ['Asistente Anfitrión', 'Co-anfitrión', 'Anfitrión 2', 'Colaborador Anfitrión']) {
      expect(abreMiComite(enSede(t)), t).toBe(false)
    }
  })
})

describe('SRV-16 · «Encargado Logística» ya entraba, y tiene que seguir entrando', () => {
  /**
   * NO SE AGREGÓ NINGUNA REGLA PARA LOGÍSTICA, y por eso hace falta este test.
   *
   * El puesto empieza por «Encargado», así que `esPuestoDeEncargado` lo cuenta
   * como cabeza de comité desde SRV-5 y la pantalla ya se le abría: 16
   * personas en 14 sedes, medido el 2026-09-30. El punto 1 de SRV-16 pedía
   * darles acceso y resultó estar hecho.
   *
   * Lo que se fija acá es que un recorte futuro de esa regla —ya pasó: la lista
   * NO_SON_CABEZA tuvo «Encargado Logística» dentro y hubo que sacarlo el
   * 2026-09-21— no se lo quite en silencio.
   */
  it('el título cuenta como encargado', () => {
    expect(esPuestoDeEncargado('Encargado Logística')).toBe(true)
    expect(esPuestoDeEncargado('Encargado Logistica')).toBe(true)
  })

  it('y por eso abre su comité', () => {
    expect(abreMiComite(enSede('Encargado Logística'))).toBe(true)
    expect(abreMiComite(enSede('Encargado Logistica', 'Sede Madrid Home'))).toBe(true)
  })

  it('el encargado de un comité que no es de sede sigue igual', () => {
    expect(abreMiComite(enComite('Encargado Servidores'))).toBe(true)
    expect(abreMiComite(enComite('Encargado'))).toBe(true)
  })

  it('«Asistente Logística» y «Colaborador Logística» NO entran', () => {
    // No se pidieron (Floriana, 2026-09-30). Son 8 personas; ampliar es una
    // decisión aparte, no un efecto colateral de este cambio.
    for (const t of ['Asistente Logística', 'Colaborador Logística']) {
      expect(abreMiComite(enSede(t)), t).toBe(false)
    }
  })
})

/**
 * LA PARTE QUE MÁS IMPORTA: mirar la pantalla NO es mandar en el comité.
 *
 * `getManageableCommitteeIds` alimenta tres cosas más —solicitar puestos, abrir
 * la ficha de cualquiera del comité y el rol `lider_comite` que se sincroniza
 * solo—. Si alguien resuelve el "duplicado" fusionando las dos funciones, el
 * anfitrión se lleva esos tres permisos sin que nadie lo haya pedido.
 */
describe('SRV-16 · la función nueva NO reemplaza a la de mandar', () => {
  const SERVERS = 'src/lib/supabase/queries/servers.ts'

  it('las dos funciones existen, por separado', () => {
    const s = sinComentarios(SERVERS)
    expect(s).toContain('export async function getManageableCommitteeIds(')
    expect(s).toContain('export async function getComitesQueAbrenMiComite(')
  })

  it('solo "Mi comité" usa la ancha', () => {
    // Se ancla en la LLAMADA (`getComitesQueAbrenMiComite(`), no en el nombre
    // suelto: el nombre también aparece en la línea del import, y un test
    // anclado ahí pasa aunque nadie la invoque — ya pasó cuatro veces en este
    // repo.
    const usa = (ruta: string) => sinComentarios(ruta).includes('getComitesQueAbrenMiComite(auth.ctx.memberId)')
    expect(usa('src/app/api/servers/mi-comite/route.ts')).toBe(true)
    for (const otra of [
      'src/app/api/servers/position-requests/route.ts',
      'src/app/api/servers/committees/route.ts',
      'src/app/api/servers/manageable-committees/route.ts',
    ]) {
      expect(usa(otra), otra).toBe(false)
      expect(sinComentarios(otra), otra).toContain('getManageableCommitteeIds')
    }
  })

  it('el permiso de ver fichas ajenas sigue atado a MANDAR', () => {
    // `guard.ts` decide con esto si el encargado puede abrir la ficha completa
    // de alguien de su comité. El anfitrión no debe heredarlo.
    const g = sinComentarios('src/lib/auth/guard.ts')
    expect(g).toContain('getManageableCommitteeIds')
    expect(g).not.toContain('getComitesQueAbrenMiComite')
  })

  it('y el rol lider_comite tampoco se reparte por esto', () => {
    const s = sinComentarios(SERVERS)
    const fn = s.slice(s.indexOf('async function sincronizarRolDeLider'))
    expect(fn).toContain('getManageableCommitteeIds(memberId)')
    expect(fn).not.toContain('getComitesQueAbrenMiComite')
  })
})

describe('SRV-16 · el menú deja de preguntar solo por el rol', () => {
  it('el sidebar mira `abre_mi_comite`, que lo calcula el servidor', () => {
    // Antes exigía el rol `lider_comite`: el encargado que no lo tenía entraba
    // escribiendo la URL pero no veía el enlace (George Vivas, 2026-09-22), y
    // el anfitrión no lo tiene nunca.
    const s = sinComentarios('src/components/layout/Sidebar.tsx')
    expect(s).toContain("user?.abre_mi_comite === true")
  })

  it('y /api/auth/me lo responde desde los PUESTOS', () => {
    const s = sinComentarios('src/app/api/auth/me/route.ts')
    expect(s).toContain('getComitesQueAbrenMiComite(member.id)')
    expect(s).toContain('abre_mi_comite: abreMiComite')
  })
})

/**
 * LAS TRES CAPAS, porque cerrar una sola no abre nada.
 *
 * Verificado en el navegador el 2026-09-30 con una cuenta de anfitrión en
 * staging, y así se encontró: el endpoint ya contestaba 200 con las 18
 * personas de la sede Y LA PANTALLA IGUAL DECÍA "Acceso restringido". El corte
 * estaba tres capas antes del fetch —el layout de (admin) gatea por MÓDULO— y
 * ninguna prueba de unidad lo iba a ver.
 */
describe('SRV-16 · el puesto tiene que abrir las TRES capas', () => {
  it('1· el layout de (admin) deja pasar la ruta', () => {
    const s = sinComentarios('src/app/(admin)/layout.tsx')
    expect(s).toContain("pathname === '/servidores/mi-comite' && user.abre_mi_comite")
  })

  it('2· el menú muestra el grupo Servidores', () => {
    // Sin esto el grupo entero se filtra por módulo y el enlace no existe:
    // la persona tendría que saberse la URL de memoria.
    const s = sinComentarios('src/components/layout/Sidebar.tsx')
    expect(s).toContain("can('servidores', 'view') || user?.abre_mi_comite === true")
  })

  it('3· pero solo con la entrada que puede abrir', () => {
    // El resto de /servidores le daría 403: el módulo sigue sin tenerlo.
    const s = sinComentarios('src/components/layout/Sidebar.tsx')
    expect(s).toContain("...(can('servidores', 'view') ? SERVIDORES_SUB : [])")
  })
})
