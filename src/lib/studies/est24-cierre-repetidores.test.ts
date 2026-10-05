import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { clasificarResultado, esHistorico } from '@/lib/studies/close-result-read'

const MIGRACION = 'supabase/migrations/20261006020000_cierre_cuenta_a_quien_repite.sql'
const crudo = readFileSync(MIGRACION, 'utf8')
/**
 * Se leen las sentencias SIN los comentarios.
 *
 * La primera versión de este test fallaba contra el archivo entero porque el
 * comentario que EXPLICA el bug cita el candado viejo (`AND status =
 * 'enrolled'`). O sea que el test estaba leyendo la explicación en vez del
 * código — y habría seguido pasando aunque el arreglo se revirtiera, mientras
 * alguien dejara el comentario.
 */
const sql = crudo.replace(/^\s*--.*$/gm, '')

describe('EST-24 · el cierre cuenta a quien repite el nivel', () => {
  it('el candado de la fila ya no es solo «enrolled»', () => {
    /**
     * EL BUG (producción, 2026-10-05). La carga del 18 de julio enganchó las
     * aprobaciones viejas a los grupos nuevos: la matrícula de Mariela
     * Hernández en el grupo de 2026 nació con `status='completed'` y
     * `completed_at=2020-06-29`. Los dos UPDATE exigían `status='enrolled'`,
     * así que el cierre la saltaba EN SILENCIO y su fecha quedaba en 2020.
     */
    expect(sql).not.toMatch(/AND status = 'enrolled'/)
    // Los dos UPDATE —el de retirado y el de completado— tienen que aceptarlo.
    expect(sql.match(/AND status IN \('enrolled', 'completed'\)/g)).toHaveLength(2)
  })

  it('y NO revive salidas deliberadas', () => {
    // dropped, cancelada y transferred son decisiones tomadas; un cierre no
    // debería deshacerlas sin que alguien lo pida.
    for (const estado of ['dropped', 'cancelada', 'transferred']) {
      expect(sql, estado).not.toMatch(new RegExp(`IN \\([^)]*'${estado}'[^)]*\\)`))
    }
  })

  it('el candado del GRUPO sigue intacto: no se cierra dos veces', () => {
    // Es lo que de verdad hacía idempotente la función, y por eso se podía
    // soltar el de la fila.
    expect(sql).toMatch(/WHERE id = p_group_id AND status <> 'finalizado'/)
    expect(sql).toMatch(/IF NOT FOUND THEN RETURN false; END IF;/)
  })

  it('solo toca a quien el dirigente evaluó', () => {
    // El bucle recorre p_results, así que ampliar los estados no alcanza a
    // nadie que no haya sido evaluado a propósito.
    expect(sql).toMatch(/FOR r IN SELECT \* FROM jsonb_array_elements\(coalesce\(p_results/)
  })

  it('queda cerrada a la llave pública (SEC-3)', () => {
    expect(sql).toMatch(/revoke execute on function public\.close_group\(uuid, jsonb, uuid\) from public, anon, authenticated/)
    expect(sql).toMatch(/grant\s+execute on function public\.close_group\(uuid, jsonb, uuid\) to service_role/)
    expect(sql).toMatch(/set search_path to 'public'/)
  })
})

describe('EST-24 · la regla que separa el arrastre sigue igual', () => {
  it('aprobar ANTES de que el grupo empiece sigue siendo arrastre', () => {
    // La regla está bien: lo que estaba mal era el dato. No se toca.
    expect(esHistorico('2020-06-29', '2026-07-21')).toBe(true)
    expect(clasificarResultado(
      { status: 'completed', notes: null, completed_at: '2020-06-29' }, '2026-07-21',
    )).toBe('historico')
  })

  it('y con la fecha del cierre, la misma persona cuenta como aprobada', () => {
    // Es exactamente lo que cambia al arreglar el UPDATE: la fecha pasa a
    // ser la del cierre, y la clasificación se acomoda sola.
    expect(clasificarResultado(
      { status: 'completed', notes: null, completed_at: '2026-10-05' }, '2026-07-21',
    )).toBe('aprobado')
  })

  it('sin alguna de las dos fechas no se descarta a nadie', () => {
    expect(esHistorico(null, '2026-07-21')).toBe(false)
    expect(esHistorico('2020-06-29', null)).toBe(false)
  })
})
