/**
 * Revoca la beca del 50% de María José Ruiz Fuentes (2026-09-16).
 *
 * QUÉ PASÓ. Pidió beca para Romanos y se le aprobó al 100% (12-set). Romanos se
 * llenó (10/10) y ella pidió por escrito trasladarla: "la había solicitado para
 * Romanos pero ya está lleno, entonces quería ver si la puedo usar para este de
 * lecturas con propósito" (finance_request c6a88154). En vez de TRASLADAR la del
 * 100%, se emitió una beca NUEVA del 50% (14-set). El traslado de la del 100% ya
 * se hizo a mano el 16-set 16:57 (audit_log 4219a6ca), así que lo que queda es
 * cerrar la del 50%.
 *
 * POR QUÉ NO BASTA CON DEJARLA AHÍ. `findApplicableScholarship` filtra por
 * member+plan+active y hace `.limit(1)` SIN order by. Con dos becas activas del
 * mismo plan, cuál gana lo decide el planner: podía aplicarle la del 50% y
 * cobrarle ₡10.000 que no debe.
 *
 * Con --aplicar escribe; sin la bandera hace dry-run y rollback.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')

const MJ       = '2c04a86e-0166-4156-8b3b-d9477ab257c3'
const BECA_100 = '0099e13a-1673-4ada-a793-62ce57c4feb6'
const BECA_50  = '11abab86-4184-4920-a51e-1ed002fee9c7'
const LECTPROP = 'ff8b6e29-4bc4-4cc5-9dcb-b14a581047b4'

const aplicar = process.argv.includes('--aplicar')

;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    const { rows: antes } = await c.query(
      `select id, status, discount_value, plan_id, is_used from scholarships where id = any($1)`, [[BECA_100, BECA_50]])
    const b100 = antes.find(r => r.id === BECA_100), b50 = antes.find(r => r.id === BECA_50)
    const g = (cond, msg) => { if (!cond) throw new Error('GUARDA: ' + msg) }
    g(b100 && b100.status === 'active' && !b100.is_used, 'la del 100% no está activa y sin usar')
    g(b100.plan_id === LECTPROP, 'la del 100% no quedó apuntando a Lecturas con Propósito')
    g(Number(b100.discount_value) === 100, 'la del 100% no es del 100%')
    g(b50 && b50.status === 'active' && !b50.is_used, 'la del 50% no está activa y sin usar (¿ya se aplicó?)')
    g(b50.plan_id === LECTPROP, 'la del 50% no apunta a Lecturas con Propósito')

    await c.query(`
      update scholarships
         set status = 'revoked', updated_at = now(),
             notes = 'Revocada el 2026-09-16: se emitió por error. La solicitud '
                  || 'c6a88154-a7d0-479e-99ce-7da4831262c5 pedía TRASLADAR la beca del 100% '
                  || 'ya aprobada para Romanos (que se llenó), no emitir una nueva al 50%. '
                  || 'El traslado quedó hecho en la beca 0099e13a-1673-4ada-a793-62ce57c4feb6.'
       where id = $1`, [BECA_50])

    // Verificación: exactamente lo que el sistema buscará al matricularla.
    const { rows: ap } = await c.query(`
      select id, discount_value from scholarships
      where kind='asignada' and member_id=$1 and status='active' and entity_type='study_plan'
        and plan_id=$2 and (expires_at is null or expires_at >= now())`, [MJ, LECTPROP])
    console.log(`\nBecas aplicables a Lecturas con Propósito: ${ap.length}`)
    ap.forEach(r => console.log('  ' + JSON.stringify(r)))
    if (ap.length !== 1 || Number(ap[0].discount_value) !== 100) throw new Error('GUARDA: no quedó UNA sola beca del 100%')

    const { rows: fin } = await c.query(
      `select id, status, discount_value, plan_id, is_used from scholarships where member_id=$1 order by created_at`, [MJ])
    console.log('\nSus becas al final:'); fin.forEach(r => console.log('  ' + JSON.stringify(r)))

    if (aplicar) { await c.query('commit'); console.log('\n>>> APLICADO (commit)') }
    else { await c.query('rollback'); console.log('\n>>> DRY-RUN: rollback, no se escribió nada') }
  } catch (e) {
    await c.query('rollback'); console.error('\nROLLBACK por error:', e.message); process.exitCode = 1
  } finally { await c.end() }
})()
