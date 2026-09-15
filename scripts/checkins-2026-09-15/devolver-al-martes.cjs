/**
 * Devolver al martes los dos check-ins que moví al miércoles.
 *   npx tsx --env-file=.env.local scripts/checkins-2026-09-15/devolver-al-martes.cjs [--aplicar]
 *
 * Los moví por la hora (17:01 y 17:07) y porque uno entró por QR, y eso apuntaba
 * a asistencia real del miércoles. El usuario confirmó que no: son del martes.
 *
 * La pista que me faltó mirar estaba en el historial: las dos personas van al
 * MARTES todas las semanas —21-jul, 28-jul, 4-ago, 18-ago, 1-set— y el 9 de
 * setiembre es la única vez que aparecen un miércoles. El día de la semana del
 * check-in pesó más que el patrón de la persona, y el patrón era la señal.
 *
 * La FECHA del check-in se corrige también, no solo el evento: si quedara el
 * 9, la pantalla del martes 8 seguiría sin mostrarlos —el filtro es por día— y
 * el problema volvería disfrazado. Se les pone la hora que tenían, corrida al
 * día 8.
 */
const L = require('../madre-2026-09/lib.cjs')
const aplicar = process.argv.includes('--aplicar')
const CR = `at time zone 'America/Costa_Rica'`

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  await c.query('begin')

  const { rows: [martes] } = await c.query(`select id from events where title='Charla Meridiano Martes'`)
  const { rows: [miercoles] } = await c.query(`select id from events where title='Charla Meridiano Miércoles'`)

  const { rows: antes } = await c.query(`
    select ec.id, m.first_name||' '||m.last_name p,
           to_char(ec.checked_in_at ${CR}, 'YYYY-MM-DD HH24:MI') cuando
    from event_checkins ec join members m on m.id=ec.member_id
    where ec.event_id=$1 and (ec.checked_in_at ${CR})::date='2026-09-09'
      and m.search_text ~* '(danilo mata corella|floriana fonseca ramirez)'`, [miercoles.id])
  console.log('a devolver:')
  antes.forEach(r => console.log(`   ${r.p} · ${r.cuando}`))
  if (antes.length !== 2) throw new Error(`se esperaban 2 y hay ${antes.length} — abortar`)

  const { rowCount } = await c.query(`
    update event_checkins
       set event_id = $2,
           -- Mismo horario, un día antes. Sin esto el filtro por día los
           -- seguiría dejando fuera de la pantalla del martes.
           checked_in_at = checked_in_at - interval '1 day'
     where id = any($1)`, [antes.map(r => r.id), martes.id])
  console.log(`\nmovidos: ${rowCount}`)

  const { rows: fin } = await c.query(`
    select e.title, (ec.checked_in_at ${CR})::date::text dia,
           trim(to_char(ec.checked_in_at ${CR},'Day')) dow, count(*)::int n
    from event_checkins ec join events e on e.id=ec.event_id
    where e.title like 'Charla Meridiano%' group by 1,2,3 order by 1,2`)
  console.log('\nCÓMO QUEDA:')
  fin.forEach(r => console.log(`   ${r.dia} (${r.dow.trim()}) ${String(r.n).padStart(4)}  «${r.title}»`))

  // Guardia: el único es (member_id, event_id, día). Si alguna ya tenía un
  // check-in al martes ese día, el update habría fallado; que no haya duplicados.
  const { rows: [dup] } = await c.query(`
    select count(*)::int n from (
      select member_id, event_id, (checked_in_at ${CR})::date d from event_checkins
      where member_id is not null group by 1,2,3 having count(*) > 1) x`)
  console.log(`\n   duplicados por persona/evento/día: ${dup.n} ${dup.n === 0 ? '✓' : '⚠️'}`)
  if (dup.n > 0) { await c.query('rollback'); console.log('❌ Rollback.'); await c.end(); return }

  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback).') }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
