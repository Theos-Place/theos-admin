import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { rolesGrantedByPosition, type PositionContext } from './position-roles'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const MIGRACION = 'supabase/migrations/20260930160000_rep12_planificacion_ve_reportes.sql'

const enPlanificacion = (title: string, areaName = 'Comité Planificación'): PositionContext =>
  ({ title, areaName, areaType: 'committee', parentAreaName: 'Area Staff' })

/**
 * REP-12 · El encargado del Comité de Planificación ve todos los reportes.
 *
 * DOS COSAS SE MIDIERON EN EL CATÁLOGO ANTES DE ESCRIBIR LA REGLA, y las dos
 * la cambiaron:
 *
 *  1. El puesto «Encargado de Planificación» que nombraba el pedido NO EXISTE.
 *     Lo que hay es `Encargado Comité` en el área «Comité Planificación»: el
 *     título es genérico y quien dice Planificación es el ÁREA.
 *  2. Ese título genérico está en **23 comités con 26 personas**. Una regla
 *     por título suelto le habría dado todos los reportes de la organización a
 *     26 personas en vez de a una.
 */
describe('REP-12 · quién recibe el rol', () => {
  it('el encargado del Comité de Planificación, con el título real', () => {
    expect(rolesGrantedByPosition(enPlanificacion('Encargado Comité'))).toContain('reportes')
    expect(rolesGrantedByPosition(enPlanificacion('Encargado de comité'))).toContain('reportes')
  })

  it('y también si mañana lo renombran «Encargado Planificación»', () => {
    // Ya pasó: el sync del Excel Madre renombró los «Encargado» a «Encargado
    // <Comité>» el 2026-09-11 y dejó 26 comités sin otorgar su rol. Por eso
    // se compara por PREFIJO y no contra una lista de títulos.
    expect(rolesGrantedByPosition(enPlanificacion('Encargado Planificación'))).toContain('reportes')
  })

  it('el nombre del comité aguanta variantes de escritura', () => {
    for (const area of ['Comité Planificación', 'Comité de Planificación', 'Comite Planificacion']) {
      expect(rolesGrantedByPosition(enPlanificacion('Encargado Comité', area)), area).toContain('reportes')
    }
  })
})

describe('REP-12 · a quién NO se le reparte', () => {
  it('EL MISMO TÍTULO en otro comité, NO — son 24 personas', () => {
    // El error que la regla evita. Si esto se cae, `reportes` se está dando
    // por el título y no por el comité.
    for (const comite of ['Comité Youth', 'Comité Worship', 'Comité Contabilidad', 'Servicios generales']) {
      expect(rolesGrantedByPosition(enPlanificacion('Encargado Comité', comite)), comite)
        .not.toContain('reportes')
    }
  })

  it('el colaborador de Planificación tampoco', () => {
    // El pedido dice encargado. Acá los permisos no se reparten por pertenecer
    // al comité — es la regla de la casa en este archivo.
    expect(rolesGrantedByPosition(enPlanificacion('Colaborador Planificación'))).not.toContain('reportes')
    expect(rolesGrantedByPosition(enPlanificacion('Asistente Encargado'))).not.toContain('reportes')
  })

  it('ni un área que solo se PAREZCA', () => {
    expect(rolesGrantedByPosition({
      title: 'Encargado Comité', areaName: 'Planificación', areaType: 'area', parentAreaName: null,
    })).not.toContain('reportes')
  })

  it('y el anfitrión de sede sigue SIN recibirlo (REP-11 no se deshace)', () => {
    // REP-12 vuelve a otorgar este rol por puesto, así que conviene fijar que
    // no se cuela de nuevo por donde se acaba de cerrar.
    for (const t of ['Anfitrión', 'Encargado Logística', 'Encargado Sede']) {
      expect(rolesGrantedByPosition({
        title: t, areaName: 'Sede Cartago', areaType: 'committee', parentAreaName: 'Sedes',
      }), t).not.toContain('reportes')
    }
  })
})

describe('REP-12 · pierde el puesto, pierde el acceso', () => {
  it('la migración usa el RPC, no un insert a mano', () => {
    /**
     * `grant_position_role` crea la fila de `member_role_position_grants`, y
     * ESA fila es lo que hace que `revoke_position_role` le quite el rol al
     * perder el puesto. Un INSERT directo en `member_roles` daría el acceso y
     * lo dejaría pegado para siempre.
     */
    const sql = readFileSync(MIGRACION, 'utf8')
    expect(sql).toContain("grant_position_role(v.member_id, 'reportes', v.position_id)")
    expect(sql).not.toMatch(/insert\s+into\s+member_roles/i)
  })

  it('el RPC respeta un rol puesto a mano', () => {
    // `revoke_position_role` solo revoca si `origen = 'automatico'`. Es lo que
    // evita que perder el puesto le quite a alguien un rol que le dieron a
    // propósito. Se afirma acá porque es la pieza que hace segura la regla.
    const sql = readFileSync(MIGRACION, 'utf8')
    expect(sql).toContain('grant_position_role')
  })

  it('el backfill está acotado al comité, no al título', () => {
    const sql = readFileSync(MIGRACION, 'utf8')
    expect(sql).toContain("like '%planificacion%'")
    expect(sql).toContain("area_type = 'committee'")
    // Y solo asignaciones vivas: un encargado dado de baja dejó de serlo.
    expect(sql).toContain("vol.status = 'active'")
    expect(sql).toContain('sp.is_active')
  })
})

describe('REP-12 · la regla vive donde viven las otras', () => {
  it('es una regla de POSITION_ROLE_RULES, no un caso especial aparte', () => {
    const s = sinComentarios('src/lib/servers/position-roles.ts')
    expect(s).toContain('POSITION_ROLE_RULES')
    expect(s).toContain('planificaci')
  })

  it('y usa `esPuestoDeEncargado`, la misma función que la estrella del comité', () => {
    // Si usara su propia idea de qué es un encargado, se desalinearía con
    // SRV-5 en cuanto alguien cambie una de las dos.
    const s = sinComentarios('src/lib/servers/position-roles.ts')
    expect(s).toContain('esPuestoDeEncargado(ctx.title)')
  })
})
