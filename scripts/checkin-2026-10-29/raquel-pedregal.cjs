/**
 * Raquel Otárola Flores sirvió en Bienvenida en la Charla Pedregal Miércoles
 * del 2026-10-28 (está asignada como servidora del evento) pero nadie le marcó
 * el check-in: el reporte no la contaba. Floriana (2026-10-29): «lo arreglas?».
 * Se inserta su check-in como SERVIDORA a la hora de inicio de la charla.
 *   node scripts/checkin-2026-10-29/raquel-pedregal.cjs [--aplicar]
 */
const fs = require('node:fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.argv.includes('--aplicar')
const EVENTO = 'd40fad32-5fec-4fb8-91e1-f58e644c711e'
const RAQUEL = 'e902a9ef-9c69-4f7a-925c-55c8fcb5825a'
const CUANDO = '2026-10-28T19:30:00-06:00'
const BACKUP = 'docs/correcciones/2026-10-29-raquel-otarola-checkin-pedregal.json'
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const { rows: [m] } = await c.query(`select first_name||' '||last_name n from members where id=$1`, [RAQUEL])
  const { rows: ya } = await c.query(`select id from event_checkins where event_id=$1 and member_id=$2 and (checked_in_at at time zone 'America/Costa_Rica')::date='2026-10-28'`, [EVENTO, RAQUEL])
  console.log(`${m.n}: check-in del 28-oct ya existente: ${ya.length}`)
  if (ya.length) { await c.end(); return }
  if (!APLICAR) { console.log('(medición; --aplicar para escribir)'); await c.end(); return }
  await c.query('begin')
  try {
    const { rows: [ci] } = await c.query(`insert into event_checkins (event_id, member_id, checked_in_at, method, checked_in_as, notes) values ($1,$2,$3,'manual','servidor','Repuesto el 2026-10-29: sirvió en Bienvenida y no se le marcó (Floriana)') returning *`, [EVENTO, RAQUEL, CUANDO])
    await c.query(`insert into audit_log (action, entity_type, entity_id, old_data, new_data) values ('INSERT','event_checkins',$1,null,$2)`, [ci.id, { ...ci, op: 'checkin_repuesto', script: 'scripts/checkin-2026-10-29/raquel-pedregal.cjs' }])
    await c.query('commit')
    fs.writeFileSync(BACKUP, JSON.stringify({ fecha: new Date().toISOString(), motivo: 'Raquel Otárola sirvió el 28-oct en Pedregal Miércoles y no tenía check-in', insertado: ci }, null, 2))
    console.log('✅ insertado', ci.id, '→', BACKUP)
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
