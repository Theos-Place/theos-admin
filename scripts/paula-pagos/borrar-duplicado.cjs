/**
 * Borra el segundo cobro de ₡5.000 de Paula García Apú en Nivel 2 (2026-09-16).
 *
 * QUÉ PASÓ. El 14-set 20:42 la matricularon en "Nivel 2. Eric Arguello", pagó
 * por SINPE (ref 2026091415283000459319968) y a las 20:43 se le aprobó el
 * comprobante: ₡5.000 pagados. A las 22:58 CANCELARON esa matrícula con el
 * motivo "Se le va a ingresar por medio de Reubicación" y un minuto después la
 * reingresaron por esa vía. La reubicación, como la solicitud tenía
 * wants_folleto = true, le generó OTRO cobro de ₡5.000.
 *
 * Los ₡5.000 del segundo cobro salen de `plan.cost` (study-requests.ts:509): el
 * código cobra el folleto al precio del plan, que es exactamente lo que ella ya
 * había pagado dos horas antes por la misma matrícula, en la misma fila de
 * study_enrollments. Es el ÚNICO pago con concept='folletos' de toda la base.
 *
 * Se borra el pendiente y queda el aprobado, que es el que tiene el comprobante
 * y la referencia del banco.
 *
 * Con --aplicar borra; sin la bandera hace dry-run y rollback.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const fs = require('fs')
const PENDIENTE = '74bf41ed-069b-44bc-9109-abd1ee5bb781'
const APROBADO  = '6025c32c-31f6-497a-a0c8-fc84c22d3c28'
const PAULA     = '736684e1-7c94-4ff4-a3bf-7a7f22e31e2e'
const aplicar = process.argv.includes('--aplicar')

;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    const { rows } = await c.query(`select * from payments where id=$1`, [PENDIENTE])
    if (rows.length !== 1) throw new Error('GUARDA: no encuentro el cobro pendiente')
    const p = rows[0]
    if (p.member_id !== PAULA) throw new Error('GUARDA: no es de Paula')
    if (p.status !== 'pending') throw new Error(`GUARDA: está en '${p.status}', no 'pending'`)
    if (p.receipt_path) throw new Error('GUARDA: tiene comprobante adjunto')
    if (p.paid_at) throw new Error('GUARDA: figura como pagado')

    // El aprobado tiene que seguir en pie: es el que no se toca.
    const { rows: ap } = await c.query(`select status, review_status, amount, receipt_path from payments where id=$1`, [APROBADO])
    if (ap[0]?.status !== 'paid' || ap[0]?.review_status !== 'aprobado') throw new Error('GUARDA: el pago aprobado no está como se esperaba')
    if (!ap[0]?.receipt_path) throw new Error('GUARDA: el aprobado no tiene comprobante')

    for (const [t, col] of [['finance_requests','payment_id'],['refunds','payment_id'],['prematrimonial_requests','payment_id']]) {
      const n = await c.query(`select count(*) from ${t} where ${col}=$1`, [PENDIENTE])
      if (Number(n.rows[0].count) > 0) throw new Error(`GUARDA: ${t} lo referencia`)
    }
    fs.writeFileSync('scripts/paula-pagos/respaldo-pago-borrado.json', JSON.stringify(rows, null, 2))

    await c.query(`delete from payments where id=$1`, [PENDIENTE])

    const fin = await c.query(`
      select id, amount, status, concept, description, review_status, receipt_path is not null as con_comprobante
      from payments where member_id=$1 order by created_at`, [PAULA])
    console.log(`pagos que le quedan: ${fin.rowCount}`)
    fin.rows.forEach(x => console.log('  ' + JSON.stringify(x)))
    if (fin.rowCount !== 1 || fin.rows[0].id !== APROBADO) throw new Error('GUARDA: no quedó solo el aprobado')

    const m = await c.query(`select status, dropped_at, drop_reason from study_enrollments where id='b214049f-eba2-4dc1-a652-f114c92857a5'`)
    console.log('matrícula en Nivel 2: ' + JSON.stringify(m.rows[0]))

    if (aplicar) { await c.query('commit'); console.log('\n>>> APLICADO (commit)') }
    else { await c.query('rollback'); console.log('\n>>> DRY-RUN: rollback') }
  } catch (e) { await c.query('rollback'); console.error('\nROLLBACK:', e.message); process.exitCode = 1 }
  finally { await c.end() }
})()
