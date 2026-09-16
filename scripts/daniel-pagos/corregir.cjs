/**
 * Arregla a Daniel Alfaro Cardoza en PAN — Casona Pedregal (2026-09-16).
 *
 * QUÉ PASÓ, del audit_log, todo el 13-set en 81 segundos:
 *   22:23:32  se matricula        → pendiente_de_pago + cobro #1 de ₡20.000
 *   22:23:56  sube comprobante, se aprueba → enrolled, PAGADO
 *   22:24:53  se matricula OTRA VEZ → la fila vuelve a pendiente_de_pago
 *                                     y nace el cobro #2 de ₡20.000
 *
 * `enrollMember` guarda con upsert sobre (group_id, member_id): la segunda
 * corrida REUSA la fila y le pisa el status, sin mirar que la persona ya estaba
 * adentro y al día. O sea, matricularse de nuevo te devuelve a deber. Por eso
 * en pantalla se ve como si se hubiera desmatriculado.
 *
 * Se borra el cobro #2 y la matrícula vuelve a 'enrolled', que es donde la dejó
 * su pago aprobado.
 *
 * Con --aplicar escribe; sin la bandera hace dry-run y rollback.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const fs = require('fs')
const DANIEL    = '0d1099b2-c6c5-44fc-8465-b6d0ccda8fcd'
const ENR       = '3d3a08b2-ac96-4023-a7f2-aeaca8fa769c'
const APROBADO  = '0b92117e-2f5b-4734-9e39-423264ad4e40'
const PENDIENTE = 'bca71469-e51a-46b8-af97-8115748f13e3'
const aplicar = process.argv.includes('--aplicar')

;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    const { rows } = await c.query(`select * from payments where id=$1`, [PENDIENTE])
    if (rows.length !== 1) throw new Error('GUARDA: no encuentro el cobro pendiente')
    const p = rows[0]
    if (p.member_id !== DANIEL) throw new Error('GUARDA: no es de Daniel')
    if (p.status !== 'pending') throw new Error(`GUARDA: está en '${p.status}'`)
    if (p.receipt_path || p.paid_at) throw new Error('GUARDA: tiene comprobante o figura pagado')

    const { rows: ap } = await c.query(`select status, review_status, amount, receipt_path from payments where id=$1`, [APROBADO])
    if (ap[0]?.status !== 'paid' || ap[0]?.review_status !== 'aprobado' || !ap[0]?.receipt_path) {
      throw new Error('GUARDA: el pago aprobado no está como se esperaba')
    }
    if (Number(ap[0].amount) !== Number(p.amount)) throw new Error('GUARDA: los montos no coinciden; no es el mismo cobro repetido')

    const { rows: m } = await c.query(`select status from study_enrollments where id=$1`, [ENR])
    if (m[0]?.status !== 'pendiente_de_pago') throw new Error(`GUARDA: la matrícula está en '${m[0]?.status}', no en 'pendiente_de_pago'`)

    for (const [t, col] of [['finance_requests','payment_id'],['refunds','payment_id'],['prematrimonial_requests','payment_id']]) {
      const n = await c.query(`select count(*) from ${t} where ${col}=$1`, [PENDIENTE])
      if (Number(n.rows[0].count) > 0) throw new Error(`GUARDA: ${t} lo referencia`)
    }
    fs.writeFileSync('scripts/daniel-pagos/respaldo-pago-borrado.json', JSON.stringify(rows, null, 2))

    await c.query(`delete from payments where id=$1`, [PENDIENTE])
    await c.query(`update study_enrollments set status='enrolled', updated_at=now() where id=$1`, [ENR])

    const fin = await c.query(`
      select id, amount, status, concept, review_status from payments where member_id=$1 order by created_at`, [DANIEL])
    console.log(`pagos que le quedan: ${fin.rowCount}`)
    fin.rows.forEach(x => console.log('  ' + JSON.stringify(x)))
    const m2 = await c.query(`select status, dropped_at, drop_reason from study_enrollments where id=$1`, [ENR])
    console.log('matrícula en PAN: ' + JSON.stringify(m2.rows[0]))
    if (fin.rowCount !== 1 || m2.rows[0].status !== 'enrolled') throw new Error('GUARDA: el estado final no es el esperado')

    if (aplicar) { await c.query('commit'); console.log('\n>>> APLICADO (commit)') }
    else { await c.query('rollback'); console.log('\n>>> DRY-RUN: rollback') }
  } catch (e) { await c.query('rollback'); console.error('\nROLLBACK:', e.message); process.exitCode = 1 }
  finally { await c.end() }
})()
