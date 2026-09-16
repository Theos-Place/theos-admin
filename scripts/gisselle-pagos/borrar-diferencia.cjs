/**
 * Borra el cobro de "Diferencia por cambio de grupo" de Gisselle López (₡20.000).
 *
 * NO es un duplicado: lo generó el traslado de LECTPROP → CTBD el 12-set. Pero
 * está MAL CALCULADO. Su matrícula quedó saldada con una beca del 100%, así que
 * el pago aprobado vale ₡0; `planDeDinero` suma los montos pagados, leyó "pagó
 * ₡0", vio que el destino cuesta ₡20.000 y cobró la diferencia entera. Los dos
 * planes valen exactamente lo mismo: la diferencia real es ₡0.
 *
 * Con --aplicar borra; sin la bandera hace dry-run y rollback.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const fs = require('fs')
const PENDIENTE = '1c66625a-ef7e-45fd-88f4-266a7d8c02d5'
const APROBADO  = '4ab61d83-79d1-43f3-8d3d-362d91a938c5'
const aplicar = process.argv.includes('--aplicar')

;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    const { rows } = await c.query(`select * from payments where id=$1`, [PENDIENTE])
    if (rows.length !== 1) throw new Error('GUARDA: no encuentro el cobro pendiente')
    const p = rows[0]
    if (p.status !== 'pending') throw new Error(`GUARDA: está en '${p.status}', no 'pending'`)
    if (p.receipt_path) throw new Error('GUARDA: tiene comprobante adjunto')
    if (p.paid_at) throw new Error('GUARDA: figura como pagado')

    for (const [t, col] of [['finance_requests','payment_id'],['refunds','payment_id'],['prematrimonial_requests','payment_id']]) {
      const n = await c.query(`select count(*) from ${t} where ${col}=$1`, [PENDIENTE])
      if (Number(n.rows[0].count) > 0) throw new Error(`GUARDA: ${t} lo referencia`)
    }
    fs.writeFileSync('scripts/gisselle-pagos/respaldo-pago-borrado.json', JSON.stringify(rows, null, 2))

    await c.query(`delete from payments where id=$1`, [PENDIENTE])

    const fin = await c.query(`
      select id, amount, status, concept, description, payment_method, review_status, scholarship_id
      from payments where member_id='15389eb8-2398-4fbc-9468-ac1ca9a5386b' order by created_at`)
    console.log(`pagos que le quedan: ${fin.rowCount}`)
    fin.rows.forEach(x => console.log('  ' + JSON.stringify(x)))
    if (fin.rowCount !== 1 || fin.rows[0].id !== APROBADO) throw new Error('GUARDA: no quedó solo el aprobado')

    const m = await c.query(`select status from study_enrollments where id='9dfe1724-78fc-441a-b721-881a0f05d2ef'`)
    console.log(`matrícula en CTBD: ${m.rows[0].status}`)

    if (aplicar) { await c.query('commit'); console.log('\n>>> APLICADO (commit)') }
    else { await c.query('rollback'); console.log('\n>>> DRY-RUN: rollback') }
  } catch (e) { await c.query('rollback'); console.error('\nROLLBACK:', e.message); process.exitCode = 1 }
  finally { await c.end() }
})()
