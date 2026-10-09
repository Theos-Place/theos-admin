/**
 * La beca de William Castro pasa de Nivel 3 a Nivel 2.
 *
 *   dry-run:  node scripts/beca-william-2026-10/a-nivel-2.cjs
 *   aplicar:  ... --aplicar
 *
 * EL CASO (Floriana, 2026-10-09): le aprobaron una beca del 100% el 30 de
 * setiembre, pero quedó asociada a NIVEL 3 — y él no está en Nivel 3. Está
 * matriculado en «Nivel 2. Viviana Artavia. Agosto 2026», que es de donde
 * sale su único cobro pendiente (₡5.000). Por eso el sistema se negaba a
 * aplicarla, con razón: una beca es un descuento para ESE estudio.
 *
 * SE CAMBIA LA BECA Y NO LA SOLICITUD. `finance_requests` guarda lo que se
 * pidió el 30 de setiembre, y eso pasó: reescribirlo borraría el rastro de
 * dónde se originó la confusión. La corrección queda en `notes` de la beca
 * y en la bitácora.
 *
 * NO SE TOCAN LOS MONTOS: el descuento es 100% y los dos niveles cuestan
 * ₡5.000, así que `original_amount` y `final_amount` siguen siendo ciertos.
 * Si los montos no calzaran, este script se detiene.
 */
const fs = require('fs')
const path = require('path')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')

const BECA = '0e4d7284-4c0b-48c9-9165-ba9f14f76974'
const APLICAR = process.argv.includes('--aplicar')

;(async () => {
  const c = nuevoCliente()
  await c.connect()

  const b = (await c.query(
    `select s.*, p.code as plan_actual, m.first_name||' '||m.last_name as persona
     from scholarships s
     left join study_plans p on p.id = s.plan_id
     join members m on m.id = s.member_id
     where s.id = $1`, [BECA])).rows[0]
  if (!b) throw new Error('No existe esa beca')
  if (b.status !== 'active' || b.is_used) {
    throw new Error(`La beca está ${b.status}${b.is_used ? ' y ya usada' : ''}: no se toca.`)
  }

  // El cobro pendiente de la persona y el plan de SU grupo: el destino real.
  const cobro = (await c.query(
    `select pay.id, pay.amount, g.name as grupo, g.plan_id, pl.code, pl.name as plan
     from payments pay
     join study_groups g on g.id = pay.study_group_id
     join study_plans pl on pl.id = g.plan_id
     where pay.member_id = $1 and pay.status = 'pending' and pay.concept = 'matricula'`,
    [b.member_id])).rows

  console.log(`persona: ${b.persona}`)
  console.log(`beca:    ${b.discount_value}% · ${b.plan_actual} → se quiere mover`)
  console.log(`cobros pendientes de matrícula: ${cobro.length}`)
  console.table(cobro.map(x => ({ grupo: x.grupo, plan: x.code, monto: x.amount })))

  // EXACTAMENTE UNO, que es la regla de AGENTS para estos cruces: con cero o
  // con dos no se puede saber a cuál moverla y se reporta sin tocar.
  if (cobro.length !== 1) {
    console.log(`\n✗ Hay ${cobro.length} cobros pendientes: no se puede decidir solo. No se toca.`)
    await c.end(); return
  }
  const destino = cobro[0]
  if (destino.plan_id === b.plan_id) {
    console.log('\n= La beca ya es de ese plan. Nada que hacer.')
    await c.end(); return
  }
  if (Number(b.original_amount) !== Number(destino.amount)) {
    console.log(`\n✗ El monto de la beca (${b.original_amount}) no calza con el cobro (${destino.amount}). No se toca.`)
    await c.end(); return
  }

  console.log(`\nmueve: ${b.plan_actual} → ${destino.code} (${destino.plan})`)
  if (!APLICAR) { console.log('\n(dry-run; agregá --aplicar)'); await c.end(); return }

  const respaldo = path.join(__dirname, `rollback-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`)
  fs.writeFileSync(respaldo, JSON.stringify({ id: b.id, plan_id: b.plan_id, notes: b.notes }, null, 2))

  const nota = [b.notes, `2026-10-09: destino corregido de ${b.plan_actual} a ${destino.code} `
    + `a pedido de Floriana — la persona está matriculada en ${destino.grupo}, no en ${b.plan_actual}. `
    + 'La solicitud original no se modificó.'].filter(Boolean).join('\n')

  await c.query('update scholarships set plan_id = $1, notes = $2, updated_at = now() where id = $3',
    [destino.plan_id, nota, BECA])
  console.log(`✓ movida\nrespaldo: ${respaldo}`)

  console.table((await c.query(
    `select p.code as plan, s.discount_value||'%' as descuento, s.status, s.is_used
     from scholarships s left join study_plans p on p.id = s.plan_id where s.id = $1`, [BECA])).rows)
  await c.end()
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
