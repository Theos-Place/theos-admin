/**
 * Check-ins cargados al evento del día equivocado.
 *   npx tsx --env-file=.env.local scripts/checkins-2026-09-15/mover-de-dia.cjs [--aplicar]
 *
 * Con el índice único viejo —un check-in por persona POR EVENTO, sin importar
 * el día— la pantalla de un recurrente mostraba la asistencia de todas las
 * semanas junta. Revisándola aparecieron check-ins en un día que no es el de la
 * regla del evento: gente marcada el miércoles en «Charla Meridiano MARTES».
 *
 * Solo se mueve lo que el usuario confirmó. El resto se reporta: mover un
 * check-in es reescribir a qué charla fue una persona, y el día de la semana es
 * una pista fuerte pero no una prueba.
 */
const L = require('../madre-2026-09/lib.cjs')
const aplicar = process.argv.includes('--aplicar')
const CR = `at time zone 'America/Costa_Rica'`

/**
 * Confirmado por el usuario (15-set) Y sostenido por la evidencia: los dos del
 * miércoles 9 en «Meridiano Martes» marcaron a las 17:01 y 17:07 —la hora a la
 * que empieza una charla— y uno de ellos por QR, o sea escaneando en el lugar.
 * Eso es asistencia real del miércoles cargada al evento del martes.
 *
 * NO se mueven los demás desfases, y la diferencia la marcó el usuario: pueden
 * ser ALTAS TARDÍAS del propio evento. Los 4 del jueves en «Pedregal
 * Miércoles» se marcaron a las 10:07 y 11:45 de la MAÑANA, a mano, y tres de
 * ellos tienen la ficha creada ese mismo día con un único check-in: son
 * personas nuevas de la charla del miércoles, digitadas al día siguiente. Están
 * en el evento correcto; lo que quedó corrido es la hora de digitación.
 */
const MOVIMIENTOS = [
  { desde: 'Charla Meridiano Martes', hacia: 'Charla Meridiano Miércoles', dia: '2026-09-09' },
]

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  await c.query('begin')

  for (const m of MOVIMIENTOS) {
    const { rows: [a] } = await c.query(`select id from events where title=$1 and is_recurring`, [m.desde])
    const { rows: [b] } = await c.query(`select id from events where title=$1 and is_recurring`, [m.hacia])
    if (!a || !b) throw new Error(`no se encontró «${m.desde}» o «${m.hacia}»`)

    const { rows: quienes } = await c.query(`
      select ec.id, coalesce(mm.first_name||' '||mm.last_name, ec.guest_name, '(invitado)') p
      from event_checkins ec left join members mm on mm.id=ec.member_id
      where ec.event_id=$1 and (ec.checked_in_at ${CR})::date = $2`, [a.id, m.dia])
    console.log(`${m.dia}: ${quienes.length} check-ins de «${m.desde}» → «${m.hacia}»`)
    quienes.forEach(q => console.log(`   ${q.p}`))

    // Choque con el único (member_id, event_id, día): si la persona YA marcó en
    // el destino ese día, el suyo es el duplicado y se borra en vez de moverse.
    const { rows: choque } = await c.query(`
      select ec.id from event_checkins ec
      where ec.event_id=$1 and (ec.checked_in_at ${CR})::date=$3 and ec.member_id is not null
        and exists (select 1 from event_checkins x where x.event_id=$2 and x.member_id=ec.member_id
                    and (x.checked_in_at ${CR})::date=$3)`, [a.id, b.id, m.dia])
    if (choque.length) {
      console.log(`   ${choque.length} ya estaban en el destino ese día: se borra el duplicado`)
      await c.query(`delete from event_checkins where id = any($1)`, [choque.map(x => x.id)])
    }
    const { rowCount } = await c.query(
      `update event_checkins set event_id=$2 where event_id=$1 and (ec_dia($1) is null or true)
         and (checked_in_at ${CR})::date=$3`.replace('(ec_dia($1) is null or true)', 'true'),
      [a.id, b.id, m.dia])
    console.log(`   movidos: ${rowCount}`)
  }

  console.log('\n── CÓMO QUEDA (recurrentes, por día):')
  const { rows: d } = await c.query(`
    select e.title, (ec.checked_in_at ${CR})::date::text dia,
           trim(to_char((ec.checked_in_at ${CR}),'Day')) dow, count(*)::int n,
           e.recurrence_rule
    from event_checkins ec join events e on e.id=ec.event_id where e.is_recurring
    group by 1,2,3,5 order by 1,2`)
  const DIA = { MON:'Monday', TUE:'Tuesday', WED:'Wednesday', THU:'Thursday', FRI:'Friday', SAT:'Saturday', SUN:'Sunday' }
  const malos = []
  for (const r of d) {
    const esperado = DIA[String(r.recurrence_rule ?? '').split(':')[1]]
    const ok = !esperado || esperado === r.dow
    console.log(`   ${ok ? ' ' : '⚠️'} ${r.dia} (${r.dow.padEnd(9)}) ${String(r.n).padStart(4)}  «${r.title}»`)
    if (!ok) malos.push(r)
  }
  if (malos.length) {
    console.log('\n   SIN CONFIRMAR, no se tocan:')
    malos.forEach(r => console.log(`      ${r.n} check-ins el ${r.dia} (${r.dow.trim()}) en «${r.title}» (${r.recurrence_rule})`))
  }

  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback).') }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
