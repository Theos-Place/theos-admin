/**
 * Nivel 3. Silvia Burgos. Noviembre 2026: tres de los cinco inscritos ya
 * tienen el folleto del Nivel 3, así que su cobro pendiente de ₡5.000 no
 * debió existir (Denise, Coordinación y Logística, 28/10/2026). Regla: los
 * cobros que nunca debieron existir se borran, no se anulan. Santiago
 * Elizondo y Herberth Preuss sí necesitan folleto y conservan el cobro.
 *
 *   node scripts/finanzas-2026-10-28/folletos-n3-silvia-burgos.cjs [--aplicar]
 */
const fs = require('node:fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.argv.includes('--aplicar')
const GRUPO = 'e97543b2-7dbf-4d45-8868-d9c34cfe462a'
const BORRAR = [
  { pago: '5724f467-13c8-48f2-ab6a-3d4bc42f2938', nombre: 'Milena Soto' },
  { pago: '22320fe7-c589-49c5-a9a5-eed18d4f6558', nombre: 'Andre Sasso' },
  { pago: '893d1f6c-317a-4521-89d9-37a7da5d1ea7', nombre: 'Irene Quiros Chacón' },
]
const BACKUP = 'docs/correcciones/2026-10-28-folletos-n3-silvia-burgos.json'

;(async () => {
  const c = nuevoCliente(); await c.connect()
  const ids = BORRAR.map(b => b.pago)
  const { rows } = await c.query(`select p.*, m.first_name||' '||m.last_name as persona from payments p join members m on m.id=p.member_id where p.id = any($1::uuid[]) and p.study_group_id=$2`, [ids, GRUPO])
  if (rows.length !== 3) throw new Error(`esperaba 3 pagos del grupo, hay ${rows.length}`)
  for (const r of rows) {
    const b = BORRAR.find(x => x.pago === r.id)
    if (r.persona !== b.nombre || r.status !== 'pending' || r.receipt_path || Number(r.amount) !== 5000) throw new Error(`no está como se midió: ${r.persona} ${r.status} ${r.receipt_path}`)
    console.log(`BORRAR ${r.persona.padEnd(22)} ₡${Number(r.amount)} ${r.status} · ${r.description}`)
  }
  const refs = (await c.query(`select tc.table_name, kcu.column_name from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
      join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
     where tc.constraint_type = 'FOREIGN KEY' and ccu.table_name = 'payments'`)).rows
  const apuntan = []
  for (const r of refs) {
    const n = (await c.query(`select count(*)::int as n from ${r.table_name} where ${r.column_name} = any($1::uuid[])`, [ids])).rows[0].n
    if (n > 0) apuntan.push(`${r.table_name}.${r.column_name}=${n}`)
  }
  console.log('los apunta:', apuntan.length ? apuntan.join(', ') : 'nada')
  if (!APLICAR) { console.log('(medición; --aplicar para escribir)'); await c.end(); return }
  if (apuntan.length) throw new Error('hay filas que apuntan a los pagos: parar y mirar')
  fs.writeFileSync(BACKUP, JSON.stringify({ fecha: new Date().toISOString(), motivo: 'Ya tienen el folleto del Nivel 3; el cobro no debió existir (Denise, 28/10/2026). Se borra, no se anula.', grupo: GRUPO, borrados: rows }, null, 2))
  await c.query('begin')
  try {
    const d = await c.query('delete from payments where id = any($1::uuid[])', [ids])
    if (d.rowCount !== 3) throw new Error(`borró ${d.rowCount}, esperaba 3`)
    for (const r of rows) await c.query(`insert into audit_log (action, entity_type, entity_id, old_data, new_data) values ('DELETE', 'payments', $1, $2, $3)`,
      [r.id, r, { op: 'cobro_de_folleto_borrado_ya_lo_tiene', persona: r.persona, grupo: GRUPO, script: 'scripts/finanzas-2026-10-28/folletos-n3-silvia-burgos.cjs' }])
    await c.query('commit')
  } catch (e) { await c.query('rollback'); throw e }
  console.log('Después:', (await c.query(`select m.first_name||' '||m.last_name persona, p.status from study_enrollments e join members m on m.id=e.member_id left join payments p on p.enrollment_id=e.id where e.group_id=$1 order by 1`, [GRUPO])).rows)
  console.log(`Respaldo en ${BACKUP}`)
  await c.end()
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
