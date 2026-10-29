/**
 * Pedregal miércoles 28-oct-2026: tres personas nuevas quedaron con ficha
 * creada desde el check-in pero SIN check-in (el operador no tocó el segundo
 * paso «Participante»). George Vivas confirmó que vinieron. Se les registra
 * la asistencia con la hora en que se creó la ficha, que es cuando pasaron
 * por la fila. Mismo evento y misma calidad (asistente) que el resto.
 */
const fs = require('node:fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.argv.includes('--aplicar')
const EVENTO = 'd40fad32-5fec-4fb8-91e1-f58e644c711e' // Charla Pedregal Miércoles
const PERSONAS = [
  '42312027-2834-4936-a1d9-461113c30123', // Valeria Charpentier Mora
  '13d37ddb-3180-4cc8-8400-40b92046bed4', // Sharon Fonseca de la O
  '82913323-4c38-4844-a491-815d46d1861e', // Dayana Hidalgo Anchía
]
const BACKUP = 'docs/correcciones/2026-10-29-pedregal-asistencias-faltantes.json'

;(async () => {
  const c = nuevoCliente(); await c.connect()
  const { rows } = await c.query(`select m.id, m.first_name||' '||m.last_name nombre, m.created_at,
      (select count(*)::int from event_checkins k where k.member_id=m.id) checkins
     from members m where m.id = any($1::uuid[]) order by m.created_at`, [PERSONAS])
  if (rows.length !== 3) throw new Error(`Esperaba 3 fichas, hay ${rows.length}`)
  for (const r of rows) console.log(`${r.nombre}  ficha=${r.created_at.toISOString()}  checkins=${r.checkins}`)
  const conCheckin = rows.filter(r => r.checkins > 0)
  if (conCheckin.length) throw new Error(`Ya tienen check-in: ${conCheckin.map(r => r.nombre).join(', ')}. Parar y mirar.`)
  if (!APLICAR) { console.log('\n(medición; --aplicar para escribir)'); await c.end(); return }
  await c.query('begin')
  try {
    const insertados = []
    for (const r of rows) {
      const ins = await c.query(`insert into event_checkins (event_id, member_id, checked_in_at, method, checked_in_as, notes)
        values ($1, $2, $3, 'manual', 'asistente', $4) returning id, checked_in_at`,
        [EVENTO, r.id, r.created_at, 'Registro repuesto el 2026-10-29: la ficha se creó desde el check-in de Pedregal pero el check-in no quedó (scripts/checkin-2026-10-29/asistencias-pedregal.cjs)'])
      insertados.push({ member_id: r.id, nombre: r.nombre, checkin_id: ins.rows[0].id, checked_in_at: ins.rows[0].checked_in_at })
      await c.query(`insert into audit_log (action, entity_type, entity_id, new_data) values ('INSERT', 'event_checkins', $1, $2)`,
        [ins.rows[0].id, { event_id: EVENTO, member_id: r.id, op: 'checkin_repuesto_pedregal_2026-10-28', motivo: 'Ficha creada desde el check-in sin check-in; George Vivas confirmó la asistencia', script: 'scripts/checkin-2026-10-29/asistencias-pedregal.cjs' }])
    }
    fs.writeFileSync(BACKUP, JSON.stringify({ fecha: new Date().toISOString(), evento: EVENTO, insertados }, null, 2))
    await c.query('commit')
    console.log('Insertados:', insertados.map(i => `${i.nombre} → ${i.checkin_id}`).join(' | '))
    console.log(`Respaldo en ${BACKUP}`)
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
