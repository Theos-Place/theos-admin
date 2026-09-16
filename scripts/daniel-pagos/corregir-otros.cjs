/**
 * Mismo defecto que Daniel Alfaro, en Alberto Vargas y Yanil Gutiérrez.
 *
 * Alberto (11-set, 27 segundos de diferencia): pagó ₡20.000 y se aprobó a las
 * 18:32:12; a las 18:33:06 una segunda matriculación le pisó la fila, lo
 * devolvió a 'pendiente_de_pago' y le creó otro cobro de ₡20.000.
 *
 * Yanil llega al mismo lugar por otro camino: el barrido de las 24 horas la
 * botó el 06-set y le canceló el cobro; el 07-set se rematriculó y ese cobro
 * viejo REVIVIÓ a 'pending'; el 08-set una tercera matriculación creó un cobro
 * nuevo, que es el que pagó. Le quedó el viejo colgando.
 *
 * En los dos casos se borra el cobro pendiente que nadie debe y, si la
 * matrícula quedó atrás en 'pendiente_de_pago' teniendo un pago aprobado, se
 * devuelve a 'enrolled'.
 *
 * Con --aplicar escribe; sin la bandera hace dry-run y rollback.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const fs = require('fs')
const CASOS = [
  { quien: 'Alberto Vargas Carpio', enr: '0d931c27-ade0-44a5-b591-18937eaf3ee3',
    aprobado: '7ebb47a9-211a-4282-a05b-9c3f74605542', pendiente: '5336a6c6-2597-4200-ad68-1ae930edac7d' },
  { quien: 'Yanil Gutiérrez Ríos',  enr: '5aa3ad53-2e6f-4bcd-b599-3891f668d198',
    aprobado: '27d28a88-ee70-4a3c-98a6-46e9fe773d78', pendiente: '7124b487-892f-4727-9566-560b6f26cefa' },
]
const aplicar = process.argv.includes('--aplicar')

;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  const respaldo = []
  try {
    for (const k of CASOS) {
      const { rows } = await c.query(`select * from payments where id=$1`, [k.pendiente])
      if (rows.length !== 1) throw new Error(`GUARDA ${k.quien}: no encuentro el pendiente`)
      const p = rows[0]
      if (p.status !== 'pending') throw new Error(`GUARDA ${k.quien}: está en '${p.status}'`)
      if (p.receipt_path || p.paid_at) throw new Error(`GUARDA ${k.quien}: tiene comprobante o figura pagado`)
      if (p.enrollment_id !== k.enr) throw new Error(`GUARDA ${k.quien}: no cuelga de esa matrícula`)

      const { rows: ap } = await c.query(`select status, review_status, amount, receipt_path, enrollment_id from payments where id=$1`, [k.aprobado])
      if (ap[0]?.status !== 'paid' || ap[0]?.review_status !== 'aprobado' || !ap[0]?.receipt_path) throw new Error(`GUARDA ${k.quien}: el aprobado no está como se esperaba`)
      if (ap[0].enrollment_id !== k.enr) throw new Error(`GUARDA ${k.quien}: el aprobado es de otra matrícula`)
      if (Number(ap[0].amount) !== Number(p.amount)) throw new Error(`GUARDA ${k.quien}: los montos no coinciden`)

      for (const [t, col] of [['finance_requests','payment_id'],['refunds','payment_id'],['prematrimonial_requests','payment_id']]) {
        const n = await c.query(`select count(*) from ${t} where ${col}=$1`, [k.pendiente])
        if (Number(n.rows[0].count) > 0) throw new Error(`GUARDA ${k.quien}: ${t} lo referencia`)
      }
      respaldo.push(p)
      await c.query(`delete from payments where id=$1`, [k.pendiente])

      // Solo si quedó atrás: Yanil ya está 'enrolled' y no hay que tocarla.
      const { rows: m } = await c.query(`select status from study_enrollments where id=$1`, [k.enr])
      if (m[0].status === 'pendiente_de_pago') {
        await c.query(`update study_enrollments set status='enrolled', updated_at=now() where id=$1`, [k.enr])
      }
      const { rows: fin } = await c.query(`select status from study_enrollments where id=$1`, [k.enr])
      const { rows: pag } = await c.query(`select id, amount, status, review_status from payments where enrollment_id=$1 order by created_at`, [k.enr])
      console.log(`${k.quien}: matrícula ${fin[0].status} · ${pag.length} pago(s)`)
      pag.forEach(x => console.log('   ' + JSON.stringify(x)))
      if (fin[0].status !== 'enrolled' || pag.length !== 1 || pag[0].status !== 'paid') throw new Error(`GUARDA ${k.quien}: estado final inesperado`)
    }
    fs.writeFileSync('scripts/daniel-pagos/respaldo-otros-borrados.json', JSON.stringify(respaldo, null, 2))

    if (aplicar) { await c.query('commit'); console.log('\n>>> APLICADO (commit)') }
    else { await c.query('rollback'); console.log('\n>>> DRY-RUN: rollback') }
  } catch (e) { await c.query('rollback'); console.error('\nROLLBACK:', e.message); process.exitCode = 1 }
  finally { await c.end() }
})()
