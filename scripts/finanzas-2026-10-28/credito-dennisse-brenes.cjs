/**
 * Dennisse Brenes Davil pagó ₡5.000 de matrícula (N1 Casona Pedregal, 19-oct)
 * y Estudios Bíblicos le canceló la matrícula el 26-oct sin crédito. Floriana
 * (2026-10-28): se le asigna un crédito a favor; está esperando otro estudio.
 * Misma forma que `congelarMatricula` en queries/creditos.ts: kind credito,
 * origin_payment_id, freeze_reason, vence con el bloque siguiente.
 *
 *   node scripts/finanzas-2026-10-28/credito-dennisse-brenes.cjs [--aplicar]
 */
const fs = require('node:fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.argv.includes('--aplicar')
const MEMBER = 'c97b11e3-ec6f-4dfb-8ca7-2d8257f36a02'
const PAGO = '09297109-062d-4e26-bf75-a9465bde1a76'
const BACKUP = 'docs/correcciones/2026-10-28-dennisse-brenes-credito.json'
const MOTIVO = 'Su matrícula de Nivel 1 (Casona Pedregal) se canceló el 2026-10-26 después de pagar; está esperando otro estudio. Crédito asignado por pedido de Floriana (2026-10-28).'

;(async () => {
  const c = nuevoCliente(); await c.connect()
  const { rows: [p] } = await c.query(`select p.*, m.first_name||' '||m.last_name as persona from payments p join members m on m.id=p.member_id where p.id=$1 and p.member_id=$2`, [PAGO, MEMBER])
  if (!p || p.status !== 'paid') throw new Error('el pago no está como se midió')
  const { rows: ya } = await c.query(`select id, status from scholarships where origin_payment_id=$1 or (member_id=$2 and kind='credito' and status='active')`, [PAGO, MEMBER])
  if (ya.length) throw new Error(`ya hay crédito: ${JSON.stringify(ya)}`)
  const { rows: [bloque] } = await c.query(`select nombre, fecha_cierre_matricula::text as cierre from capacitacion_bloques where fecha_cierre_matricula > current_date order by fecha_cierre_matricula limit 1`)
  if (!bloque) throw new Error('sin bloque siguiente')
  const vence = `${bloque.cierre}T23:59:59.999-06:00`
  console.log(`${p.persona}: pago ₡${Number(p.amount)} ${p.currency} (${p.status}, ${p.paid_at.toISOString().slice(0,10)}) → crédito ₡${Number(p.amount)} vence ${bloque.cierre} (${bloque.nombre})`)
  if (!APLICAR) { console.log('(medición; --aplicar para escribir)'); await c.end(); return }
  await c.query('begin')
  try {
    const { rows: [s] } = await c.query(`insert into scholarships (kind, member_id, discount_type, discount_value, currency, status, origin_payment_id, freeze_reason, expires_at, approved_at, reason)
      values ('credito', $1, 'fixed', $2, $3, 'active', $4, $5, $6::timestamptz, now(), 'Congelamiento de matrícula · Nivel 1') returning *`, [MEMBER, p.amount, p.currency, PAGO, MOTIVO, vence])
    await c.query(`insert into audit_log (action, entity_type, entity_id, old_data, new_data) values ('INSERT', 'scholarships', $1, null, $2)`,
      [s.id, { op: 'credito_asignado_a_mano', persona: p.persona, member_id: MEMBER, pago: PAGO, monto: Number(p.amount), vence, bloque: bloque.nombre, script: 'scripts/finanzas-2026-10-28/credito-dennisse-brenes.cjs' }])
    await c.query('commit')
    fs.writeFileSync(BACKUP, JSON.stringify({ fecha: new Date().toISOString(), motivo: MOTIVO, pago_origen: p, credito_creado: s }, null, 2))
    console.log('Creado:', s.id, '· vence', s.expires_at.toISOString(), `· respaldo en ${BACKUP}`)
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
