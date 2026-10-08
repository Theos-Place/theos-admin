/**
 * Devuelve a cada inscripción la fecha en que la persona llenó el formulario.
 *
 * EL DAÑO FUE MÍO. El script de reconciliación del 2026-10-06 creó 70
 * inscripciones sin escribir `registered_at`, así que tomaron el `now()` de
 * ese día. Las 63 que venían de respuestas viejas —del 14 de setiembre al 5
 * de octubre— quedaron todas fechadas «06 de octubre», y el tab del evento
 * se veía como si todo el mundo se hubiera inscrito el mismo día. Lo notó
 * Floriana el 2026-10-08.
 *
 * Llenar el formulario ES inscribirse: `form_responses.submitted_at` es la
 * fecha verdadera y es la que se repone.
 *
 * SOLO toca inscripciones que TIENEN respuesta enlazada y cuya fecha no
 * calza. Una inscripción hecha por el botón del evento no tiene respuesta y
 * no se toca — ahí el `registered_at` sí es la verdad.
 *
 * Guarda respaldo con los valores anteriores.
 */
const fs = require('fs')
const path = require('path')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')

const APLICAR = process.argv.includes('--aplicar')

;(async () => {
  const c = nuevoCliente()
  await c.connect()

  const { rows } = await c.query(`
    select g.id, g.registered_at, r.submitted_at, e.title as evento,
           coalesce(m.first_name||' '||m.last_name,'?') as persona
    from event_registrations g
    join form_responses r on r.id = g.form_response_id
    join events e on e.id = g.event_id
    left join members m on m.id = g.member_id
    where g.registered_at is distinct from r.submitted_at
    order by r.submitted_at`)

  // Un desfase de segundos es el camino normal (la respuesta y la inscripción
  // nacen casi a la vez); lo que se corrige es el que cambia el DÍA en CR.
  const dia = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica' }).format(new Date(d))
  const corregir = rows.filter(r => dia(r.registered_at) !== dia(r.submitted_at))

  console.log(`inscripciones con respuesta y fecha distinta: ${rows.length}`)
  console.log(`  cambian de DÍA (se corrigen):   ${corregir.length}`)
  console.log(`  difieren por segundos (se dejan): ${rows.length - corregir.length}`)
  if (corregir.length) {
    const porEvento = new Map()
    for (const r of corregir) porEvento.set(r.evento, (porEvento.get(r.evento) ?? 0) + 1)
    console.table([...porEvento].map(([evento, n]) => ({ evento, n })))
    console.log('\nprimeras 5:')
    console.table(corregir.slice(0, 5).map(r => ({
      persona: r.persona, decia: dia(r.registered_at), queda: dia(r.submitted_at),
    })))
  }

  if (!APLICAR) { console.log('\n(dry-run; agregá --aplicar)'); await c.end(); return }
  if (corregir.length === 0) { console.log('\nNada que corregir.'); await c.end(); return }

  const respaldo = path.join(__dirname, `rollback-fechas-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`)
  fs.writeFileSync(respaldo, JSON.stringify(
    corregir.map(r => ({ id: r.id, registered_at: r.registered_at })), null, 2))
  console.log('\nrespaldo:', respaldo)

  let n = 0
  for (const r of corregir) {
    const { rowCount } = await c.query(
      'update event_registrations set registered_at = $1 where id = $2', [r.submitted_at, r.id])
    n += rowCount
  }
  console.log(`corregidas: ${n}`)

  console.table((await c.query(`
    select to_char(g.registered_at at time zone 'America/Costa_Rica','DD-Mon') as dia, count(*)::int
    from event_registrations g
    where g.event_id = (select id from events where title='Actividad Servidores' limit 1)
    group by 1 order by min(g.registered_at)`)).rows)
  await c.end()
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
