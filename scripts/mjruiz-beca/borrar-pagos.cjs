/**
 * Borra los dos pagos CANCELADOS de María José Ruiz (2026-09-16), pedido por TI.
 *
 * Los dos son de ₡20.000 por "Matrícula · Lecturas con Propósito", quedaron en
 * 'cancelado' cuando el barrido le soltó el cupo (uno el 14-set, otro el 16-set)
 * y ninguno tiene comprobante. Verificado antes de borrar: cero filas en
 * finance_requests, refunds y prematrimonial_requests apuntando a ellos. El
 * trigger audit_payments cubre DELETE, así que el old_data queda en audit_log.
 *
 * Igual se guarda un respaldo en JSON acá al lado, porque audit_log no es un
 * lugar cómodo para recuperar una fila.
 *
 * Con --aplicar borra; sin la bandera hace dry-run y rollback.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const fs = require('fs')
const PAGOS = ['05faec70-9164-4a42-9bb2-16b6559d8745','10762435-d76e-42c4-8ea1-66e30557975d']
const aplicar = process.argv.includes('--aplicar')

;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    const { rows } = await c.query(`select * from payments where id = any($1)`, [PAGOS])
    if (rows.length !== 2) throw new Error(`GUARDA: esperaba 2 pagos, hay ${rows.length}`)
    for (const p of rows) {
      if (p.status !== 'cancelado') throw new Error(`GUARDA: el pago ${p.id} está en '${p.status}', no 'cancelado'`)
      if (p.receipt_path) throw new Error(`GUARDA: el pago ${p.id} tiene comprobante adjunto`)
      if (p.paid_at) throw new Error(`GUARDA: el pago ${p.id} figura como pagado`)
    }
    fs.writeFileSync('scripts/mjruiz-beca/respaldo-pagos-borrados.json', JSON.stringify(rows, null, 2))
    console.log('respaldo escrito en scripts/mjruiz-beca/respaldo-pagos-borrados.json')

    const del = await c.query(`delete from payments where id = any($1)`, [PAGOS])
    console.log(`borrados: ${del.rowCount}`)
    const quedan = await c.query(`select id, amount, status, concept from payments where member_id='2c04a86e-0166-4156-8b3b-d9477ab257c3'`)
    console.log(`pagos que le quedan: ${quedan.rowCount}`)
    quedan.rows.forEach(x => console.log('  ' + JSON.stringify(x)))

    if (aplicar) { await c.query('commit'); console.log('\n>>> APLICADO (commit)') }
    else { await c.query('rollback'); console.log('\n>>> DRY-RUN: rollback') }
  } catch (e) {
    await c.query('rollback'); console.error('\nROLLBACK:', e.message); process.exitCode = 1
  } finally { await c.end() }
})()
