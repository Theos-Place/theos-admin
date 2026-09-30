import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import {
  ACCESO_POR_REPORTE, puedeVerReporte, reportesVisibles, type SlugDeReporte,
} from './acceso-por-reporte'
import { abreReportesDeSede, PUESTOS_QUE_ABREN_REPORTES } from './puestos-que-abren-reportes'
import { rolesGrantedByPosition, type PositionContext } from '@/lib/servers/position-roles'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const TODOS = Object.keys(ACCESO_POR_REPORTE) as SlugDeReporte[]

/** Alguien con el módulo `reportes` y nada más — el rol `reportes` a secas. */
const soloModulo = { roles: ['reportes'], tieneModulo: true }
/** El anfitrión después de REP-11: sin rol de reportes, con su puesto. */
const soloPuesto = { roles: ['miembro'], tieneModulo: false, porPuesto: true }
const nadie = { roles: ['miembro'], tieneModulo: false }

describe('REP-11 · el puesto abre DOS reportes, no los siete', () => {
  it('Crecimiento/Asistencia y Personas Nuevas, sí', () => {
    expect(puedeVerReporte('asistencia', soloPuesto)).toBe(true)
    expect(puedeVerReporte('personas-nuevas', soloPuesto)).toBe(true)
  })

  it('los otros cinco, no', () => {
    // Esto es literalmente lo que REP-11 deshace: PAR-3 le daba el rol
    // `reportes` entero y con él se llevaba Discípulos, Retención y
    // Dirigentes, que nadie le había dado.
    for (const slug of ['discipulos', 'retencion', 'estudios', 'dirigentes', 'servidores'] as SlugDeReporte[]) {
      expect(puedeVerReporte(slug, soloPuesto), slug).toBe(false)
    }
  })

  it('el índice le muestra exactamente esas dos tarjetas', () => {
    expect(reportesVisibles(soloPuesto).sort()).toEqual(['asistencia', 'personas-nuevas'])
  })

  it('y solo DOS reportes se abren por puesto, en toda la tabla', () => {
    // El cebo de la tabla: si alguien pone `porPuesto: true` en un reporte
    // más, esto se cae y hay que decidirlo a propósito.
    const porPuesto = TODOS.filter(s => ACCESO_POR_REPORTE[s].porPuesto)
    expect(porPuesto.sort()).toEqual(['asistencia', 'personas-nuevas'])
  })
})

describe('REP-11 · Estudios y Dirigentes quedan acotados', () => {
  it('el módulo `reportes` ya NO alcanza para ninguno de los dos', () => {
    expect(puedeVerReporte('estudios', soloModulo)).toBe(false)
    expect(puedeVerReporte('dirigentes', soloModulo)).toBe(false)
  })

  it('pero sí los abren coordinación de estudios y de dirigentes', () => {
    for (const rol of ['coordinador_estudios', 'coordinador_dirigentes', 'direccion', 'admin']) {
      expect(puedeVerReporte('estudios', { roles: [rol], tieneModulo: false }), rol).toBe(true)
      expect(puedeVerReporte('dirigentes', { roles: [rol], tieneModulo: false }), rol).toBe(true)
    }
  })

  it('coordinación de SERVIDORES no los abre, aunque tenga el módulo', () => {
    // Es el cambio que cuesta: son 5 personas que hoy ven el de Dirigentes.
    // Medido y confirmado el 2026-09-30 antes de aplicarlo.
    const coord = { roles: ['coordinador_servidores'], tieneModulo: true }
    expect(puedeVerReporte('dirigentes', coord)).toBe(false)
    expect(puedeVerReporte('estudios', coord)).toBe(false)
    // Lo suyo sí:
    expect(puedeVerReporte('servidores', coord)).toBe(true)
  })
})

describe('REP-11 · el módulo sigue abriendo lo que siempre abrió', () => {
  it('los cuatro reportes generales', () => {
    for (const slug of ['asistencia', 'personas-nuevas', 'discipulos', 'retencion'] as SlugDeReporte[]) {
      expect(puedeVerReporte(slug, soloModulo), slug).toBe(true)
    }
  })

  it('dirección y admin ven los siete', () => {
    for (const rol of ['direccion', 'admin']) {
      expect(reportesVisibles({ roles: [rol], tieneModulo: true }).length, rol).toBe(TODOS.length)
    }
  })

  it('sin nada, ninguno', () => {
    expect(reportesVisibles(nadie)).toEqual([])
    expect(reportesVisibles({ roles: null, tieneModulo: false })).toEqual([])
    expect(reportesVisibles({ roles: undefined, tieneModulo: false })).toEqual([])
  })

  it('un slug que no existe no abre nada', () => {
    expect(puedeVerReporte('inventado' as SlugDeReporte, { roles: ['admin'], tieneModulo: true })).toBe(false)
  })
})

describe('REP-11 · qué puesto abre los reportes', () => {
  const enSede = (title: string): PositionContext =>
    ({ title, areaName: 'Sede Cartago', areaType: 'committee', parentAreaName: 'Sedes' })

  it('anfitrión y encargado de logística', () => {
    for (const t of ['Anfitrión', 'Anfitrión 1', 'Encargado Logística', 'Encargado Logistica']) {
      expect(abreReportesDeSede(enSede(t)), t).toBe(true)
    }
  })

  it('asistente y colaborador de logística, no', () => {
    for (const t of ['Asistente Logística', 'Colaborador Logística', 'Coordinador Bienvenida']) {
      expect(abreReportesDeSede(enSede(t)), t).toBe(false)
    }
  })

  it('fuera de un comité de sede, no', () => {
    expect(abreReportesDeSede({
      title: 'Anfitrión', areaName: 'Comité Mujeres',
      areaType: 'committee', parentAreaName: 'Área Espiritual',
    })).toBe(false)
  })

  it('los anfitriones se reusan de SRV-16, no se copian', () => {
    // Dos listas con los mismos títulos se separan en cuanto alguien agregue
    // una variante a una sola.
    expect(PUESTOS_QUE_ABREN_REPORTES.has('anfitrion')).toBe(true)
    expect(PUESTOS_QUE_ABREN_REPORTES.has('anfitrion 1')).toBe(true)
    expect(sinComentarios('src/lib/reports/puestos-que-abren-reportes.ts'))
      .toContain('ANFITRIONES_QUE_ABREN_MI_COMITE')
  })
})

/**
 * LA PARTE QUE MÁS IMPORTA: la regla tiene que estar en UN lugar.
 *
 * Antes estaba en tres que se contradecían —el índice, cada pantalla y cada
 * endpoint—, y por eso el reporte de Dirigentes no filtraba nada en el índice
 * mientras su endpoint se conformaba con el módulo.
 */
describe('REP-11 · una sola tabla, y todos preguntan', () => {
  it('NINGÚN puesto de SEDE otorga ya el rol `reportes`', () => {
    /**
     * Antes este test prohibía la palabra `role: 'reportes'` en todo
     * `position-roles.ts`, y después contaba que hubiera UNA sola regla. Las
     * dos formas envejecieron mal: hoy son DOS reglas legítimas —el encargado
     * del Comité de Planificación (REP-12) y el Director de Área— y mañana
     * puede haber otra.
     *
     * Contar reglas nunca fue lo que importaba. Lo que REP-11 cerró es que el
     * rol se repartiera por un puesto de SEDE, y eso se afirma con DATOS y no
     * leyendo el archivo: se le pasan los títulos reales del catálogo de
     * sedes y se comprueba que ninguno lo recibe.
     */
    const deSede = [
      'Anfitrión', 'Anfitrión 1', 'Encargado Logística', 'Encargado Logistica',
      'Asistente Logística', 'Colaborador Logística', 'Encargado Sede',
      'Colaborador Bienvenida', 'Coordinador Información', 'Logística',
    ]
    for (const title of deSede) {
      expect(rolesGrantedByPosition({
        title, areaName: 'Sede Pedregal Domingos',
        areaType: 'committee', parentAreaName: 'Sedes',
      }), title).not.toContain('reportes')
    }
  })

  it('y tampoco lo otorga el encargado de un comité cualquiera', () => {
    // El rol solo sale de Planificación y de dirigir un área. `Encargado
    // Comité` está en 23 comités: si alguno lo recibiera, la regla estaría
    // mirando el título.
    for (const areaName of ['Comité Youth', 'Comité Worship', 'Comité Contabilidad']) {
      expect(rolesGrantedByPosition({
        title: 'Encargado Comité', areaName, areaType: 'committee', parentAreaName: 'Area Staff',
      }), areaName).not.toContain('reportes')
    }
  })

  it('pero el mecanismo de sync se queda', () => {
    // El ítem lo pide explícito: se quita ESE mapeo, no el motor.
    const s = sinComentarios('src/lib/servers/position-roles.ts')
    expect(s).toContain('POSITION_ROLE_RULES')
    expect(s).toContain('rolesGrantedByPosition')
    expect(s).toContain("role: 'encargado_eventos'")
  })

  it('TODOS los endpoints de reportes usan el guard nuevo', () => {
    // Se recorre la CARPETA y no una lista escrita a mano: un endpoint nuevo
    // que se olvide del guard tiene que hacer fallar esto, y una lista no lo
    // haría porque nadie se acuerda de agregarlo.
    const dir = 'src/app/api/reports'
    for (const ep of readdirSync(dir)) {
      const s = sinComentarios(`${dir}/${ep}/route.ts`)
      expect(s, ep).toContain('requireAccesoAReporte(')
      expect(s, ep).not.toContain("requireModuleView('reportes')")
    }
  })

  it('y cada uno pide un slug que EXISTE en la tabla', () => {
    const dir = 'src/app/api/reports'
    for (const ep of readdirSync(dir)) {
      const s = sinComentarios(`${dir}/${ep}/route.ts`)
      const m = /requireAccesoAReporte\('([a-z-]+)'\)/.exec(s)
      expect(m, ep).toBeTruthy()
      expect(TODOS, `${ep} pide '${m![1]}'`).toContain(m![1] as SlugDeReporte)
    }
  })

  it('el índice filtra con la tabla, no con una lista propia', () => {
    const s = sinComentarios('src/app/(admin)/reportes/page.tsx')
    expect(s).toContain('puedeVerReporte(r.slug, quien)')
    // La copia vieja: cada tarjeta traía su propio `roles:`.
    expect(s).not.toMatch(/roles: (ESTUDIOS_REPORTE_ROLES|SERVICE_ADMIN_ROLES)/)
  })

  it('y las pantallas preguntan con el hook, no con roles a mano', () => {
    for (const p of ['estudios', 'servidores', 'dirigentes']) {
      const s = sinComentarios(`src/app/(admin)/reportes/${p}/page.tsx`)
      expect(s, p).toContain(`useAccesoAReporte('${p}')`)
    }
  })

  it('la de Dirigentes, que no tenía gate, ahora lo tiene', () => {
    // Sin esto habría mostrado "Error cargando el reporte" a las 5 personas
    // que pierden el acceso — se lee como una falla, no como una puerta.
    const s = sinComentarios('src/app/(admin)/reportes/dirigentes/page.tsx')
    expect(s).toContain('if (!puedeVer)')
    expect(s).toContain('Acceso restringido')
  })

  it('el cliente y el servidor preguntan lo MISMO', () => {
    expect(sinComentarios('src/hooks/useAccesoAReporte.ts')).toContain('puedeVerReporte(slug, {')
    expect(sinComentarios('src/lib/auth/guard.ts')).toContain('puedeVerReporte(slug, base)')
  })
})

describe('REP-11 · la consulta de puestos no se hace de gusto', () => {
  it('el guard la deja para el final y solo si el reporte la necesita', () => {
    // Es una consulta por request en un endpoint pesado. Para dirección o
    // para quien tiene el módulo no tiene que tocar la base.
    const s = sinComentarios('src/lib/auth/guard.ts')
    const fn = s.slice(s.indexOf('export async function requireAccesoAReporte'))
    expect(fn.indexOf('puedeVerReporte(slug, base)')).toBeLessThan(fn.indexOf('abreReportesPorPuesto'))
    expect(fn).toContain('ACCESO_POR_REPORTE[slug]?.porPuesto')
  })
})

/**
 * LAS TRES CAPAS OTRA VEZ, y por segunda vez en el mismo día lo encontró el
 * navegador y no las pruebas: con los endpoints ya contestando 200 para
 * Crecimiento y Personas Nuevas, el índice mostraba "Acceso restringido"
 * —el layout de (admin) gatea por MÓDULO— y el menú escondía la entrada de
 * Reportes por lo mismo.
 */
describe('REP-11 · el puesto tiene que abrir las TRES capas', () => {
  it('1· el layout deja pasar SOLO el índice y los dos reportes', () => {
    const s = sinComentarios('src/app/(admin)/layout.tsx')
    expect(s).toContain('user.abre_reportes_por_puesto')
    expect(s).toContain("['/reportes', '/reportes/asistencia', '/reportes/personas-nuevas']")
    // El cebo: la excepción no puede ser un prefijo. `/reportes/estudios`
    // empieza con `/reportes` y no debe colarse.
    expect(s).not.toContain("pathname.startsWith('/reportes') && user.abre_reportes_por_puesto")
  })

  it('2· el menú muestra la entrada de Reportes', () => {
    const s = sinComentarios('src/components/layout/Sidebar.tsx')
    expect(s).toContain("can('reportes', 'view') || user?.abre_reportes_por_puesto === true")
  })

  it('3· y /api/auth/me responde el dato desde los PUESTOS', () => {
    const s = sinComentarios('src/app/api/auth/me/route.ts')
    expect(s).toContain('abreReportesPorPuesto(member.id)')
    expect(s).toContain('abre_reportes_por_puesto: abreReportes')
  })

  it('las rutas de la excepción son exactamente los reportes con porPuesto', () => {
    // Si mañana se agrega un tercer reporte por puesto en la tabla y nadie
    // toca el layout, la pantalla diría "Acceso restringido" sin que ningún
    // test lo note. Esto ata las dos listas.
    const s = readFileSync('src/app/(admin)/layout.tsx', 'utf8')
    const porPuesto = TODOS.filter(x => ACCESO_POR_REPORTE[x].porPuesto)
    for (const slug of porPuesto) expect(s, slug).toContain(`'/reportes/${slug}'`)
  })
})
