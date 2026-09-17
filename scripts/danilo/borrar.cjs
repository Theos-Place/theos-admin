/**
 * Borra la matrícula de prueba de Danilo Mata Corella en "Nivel 4. Floriana
 * Fonseca. Junio 2026" y su cobro (2026-09-17, pedido por TI: fue una prueba).
 *
 * NO se toca su otra matrícula: LECTPROP — La Sabana, con ₡20.000 pagados,
 * comprobante adjunto y aprobado. Esa es real.
 *
 * Tampoco se toca a Danilo Mata UGALDE, que es otra persona (cédula distinta) y
 * apareció en la búsqueda por nombre.
 *
 * Con --aplicar borra; sin la bandera hace dry-run y rollback.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const fs = require('fs')
const DANILO = 'f4d0952e-645b-4064-b8f9-b1ada3d62d84'  // Mata Corella
const GRUPO  = '46b307f3-6184-484a-bb81-e4cadff84b36'  // Nivel 4 de Floriana
const ENR    = '7dfcb575-84b4-46a1-aefe-f1e3353ff994'
const PAGO   = '6c6986cf-390b-4cd4-a86f-6ec65d63f38b'
const INTACTO = 'c9396e4a-3b5c-4d7e-a2ba-bdf97a01a1a7' // su matrícula REAL en LECTPROP
const aplicar = process.argv.includes('--aplicar')

;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    const { rows: e } = await c.query(`select * from study_enrollments where id=$1`, [ENR])
    if (e.length !== 1) throw new Error('GUARDA: no encuentro la matrícula')
    if (e[0].member_id !== DANILO) throw new Error('GUARDA: la matrícula no es de Danilo Mata Corella')
    if (e[0].group_id !== GRUPO) throw new Error('GUARDA: no es el Nivel 4 de Floriana')
    if (e[0].status !== 'pendiente_de_pago') throw new Error(`GUARDA: está en '${e[0].status}', no en 'pendiente_de_pago'`)
    if (e[0].grade !== null || e[0].completed_at !== null) throw new Error('GUARDA: tiene nota o fecha de cierre — no parece una prueba')

    const { rows: p } = await c.query(`select * from payments where id=$1`, [PAGO])
    if (p.length !== 1) throw new Error('GUARDA: no encuentro el cobro')
    if (p[0].enrollment_id !== ENR) throw new Error('GUARDA: el cobro no cuelga de esa matrícula')
    if (p[0].status !== 'pending') throw new Error(`GUARDA: el cobro está en '${p[0].status}'`)
    if (p[0].receipt_path || p[0].paid_at) throw new Error('GUARDA: el cobro tiene comprobante o figura pagado')

    // Nada más puede colgar de la matrícula.
    for (const [t, col] of [['scholarship_redemptions','enrollment_id'], ['study_requests','resulting_enrollment_id'],
                            ['cdeb_recommendations','enrollment_id'], ['payment_plans','enrollment_id']]) {
      const n = await c.query(`select count(*) n from ${t} where ${col}=$1`, [ENR])
      if (Number(n.rows[0].n) > 0) throw new Error(`GUARDA: ${t} referencia esta matrícula`)
    }

    fs.writeFileSync('scripts/danilo/respaldo.json', JSON.stringify({ matricula: e[0], pago: p[0] }, null, 2))
    await c.query(`delete from payments where id=$1`, [PAGO])
    await c.query(`delete from study_enrollments where id=$1`, [ENR])

    // Verificación: el grupo queda sin él, y su matrícula real sigue en pie.
    const enGrupo = await c.query(`select count(*) n from study_enrollments where group_id=$1 and member_id=$2`, [GRUPO, DANILO])
    const real = await c.query(`
      select e.status, pa.amount, pa.status pago from study_enrollments e
      left join payments pa on pa.enrollment_id=e.id where e.id=$1`, [INTACTO])
    const pagos = await c.query(`select count(*) n from payments where member_id=$1`, [DANILO])
    console.log(`matrículas de Danilo en el Nivel 4 de Floriana: ${enGrupo.rows[0].n}`)
    console.log(`su matrícula REAL (LECTPROP) sigue: ${JSON.stringify(real.rows[0])}`)
    console.log(`pagos que le quedan en total: ${pagos.rows[0].n}`)
    if (Number(enGrupo.rows[0].n) !== 0) throw new Error('GUARDA: la matrícula no se borró')
    if (!real.rows[0] || real.rows[0].status !== 'enrolled') throw new Error('GUARDA: se tocó la matrícula real')
    if (Number(pagos.rows[0].n) !== 1) throw new Error('GUARDA: debería quedarle exactamente 1 pago')

    if (aplicar) { await c.query('commit'); console.log('\n>>> APLICADO (commit)') }
    else { await c.query('rollback'); console.log('\n>>> DRY-RUN: rollback') }
  } catch (e) { await c.query('rollback'); console.error('\nROLLBACK:', e.message); process.exitCode = 1 }
  finally { await c.end() }
})()
