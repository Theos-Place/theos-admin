/**
 * Mariela Meléndez subió DOS veces la misma captura del SINPE del 31-ago
 * (comprobante 51236100, ₡5.000): una para SCJ Santo Domingo (matrícula
 * luego cancelada) y otra para SCJ Heredia (donde está). Un solo pago real.
 * Floriana (2026-10-27): se borra el duplicado, no se devuelve nada. Regla:
 * los cobros que nunca debieron existir se borran, no se anulan.
 */
const fs = require('node:fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.argv.includes('--aplicar')
const DUPLICADO = 'ee63f3c9-af3c-413a-9cce-803e18d07cc7'
const SE_QUEDA = 'ab70e8b4-0ff4-482e-83ba-f059ba93280a'
const BACKUP = 'docs/correcciones/2026-10-27-mariela-melendez-pago-duplicado.json'

;(async () => {
  const c = nuevoCliente(); await c.connect()
  const { rows } = await c.query('select * from payments where id = any($1::uuid[])', [[DUPLICADO, SE_QUEDA]])
  if (rows.length !== 2) throw new Error(`Esperaba 2 pagos, hay ${rows.length}`)
  const refs = (await c.query(`
    select tc.table_name, kcu.column_name from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
      join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
     where tc.constraint_type = 'FOREIGN KEY' and ccu.table_name = 'payments'`)).rows
  const quienLoApunta = []
  for (const r of refs) {
    const n = (await c.query(`select count(*)::int as n from ${r.table_name} where ${r.column_name} = $1`, [DUPLICADO])).rows[0].n
    if (n > 0) quienLoApunta.push(`${r.table_name}.${r.column_name}=${n}`)
  }
  for (const r of rows) console.log(`${r.id === DUPLICADO ? 'BORRAR ' : 'queda  '} ${r.id} ₡${Number(r.amount)} ${r.status} matrícula=${r.enrollment_id} pagado=${r.paid_at?.toISOString().slice(0, 10)} comprobante=${r.receipt_path}`)
  console.log('lo apunta:', quienLoApunta.length ? quienLoApunta.join(', ') : 'nada')
  if (!APLICAR) { console.log('\n(medición; --aplicar para escribir)'); await c.end(); return }
  if (quienLoApunta.length) throw new Error('Hay filas que apuntan al pago: parar y mirar')
  fs.writeFileSync(BACKUP, JSON.stringify({ fecha: new Date().toISOString(), motivo: 'Mismo SINPE subido dos veces (comprobante 51236100); se borra el duplicado (Floriana, 2026-10-27)', borrado: rows.find(r => r.id === DUPLICADO), se_queda: SE_QUEDA }, null, 2))
  await c.query('begin')
  try {
    const d = await c.query('delete from payments where id = $1', [DUPLICADO])
    if (d.rowCount !== 1) throw new Error('No borró 1 fila')
    await c.query(`insert into audit_log (action, entity_type, entity_id, old_data, new_data) values ('DELETE', 'payments', $1, $2, $3)`,
      [DUPLICADO, rows.find(r => r.id === DUPLICADO), { op: 'pago_duplicado_borrado', mismo_sinpe_que: SE_QUEDA, comprobante_sinpe: '51236100', script: 'scripts/creditos-2026-10-27/borrar-pago-duplicado-mariela.cjs' }])
    await c.query('commit')
  } catch (e) { await c.query('rollback'); throw e }
  console.log('Después:', (await c.query('select id, amount::int, status from payments where id = any($1::uuid[])', [[DUPLICADO, SE_QUEDA]])).rows)
  console.log(`Respaldo en ${BACKUP}`)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
