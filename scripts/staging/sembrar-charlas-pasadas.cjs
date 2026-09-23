/**
 * INF-1 · Charlas YA REALIZADAS, para que un ambiente nuevo tenga historia.
 *
 * EL ESLABÓN QUE FALTABA. `seed-datos-de-prueba` cuelga asistencia de charlas de
 * los últimos 170 días y se niega si hay menos de seis. En producción esas
 * charlas existen porque llevan meses sucediendo; en una base recién creada no
 * hay ninguna, y `seed-charlas` solo crea las de ESTA semana. Ese era el último
 * punto donde el arranque de staging se caía.
 *
 * No se toca `seed-charlas.ts`: ése crea las charlas reales que la gente ve en
 * el calendario, y ensuciarlo con semanas hacia atrás sería meterle al
 * calendario de producción eventos inventados.
 *
 * Lo que genera es deliberadamente mínimo: el evento y nada más. Quién asistió
 * lo pone `seed-datos-de-prueba` con sus personas [prueba].
 *
 *   SUPABASE_DB_URL=… node scripts/staging/sembrar-charlas-pasadas.cjs [semanas]
 */
const { Client } = require('pg')

const SEMANAS = Number(process.argv[2] ?? 12)
// Las mismas sedes que seed-charlas, con su día de la semana (0=domingo).
const SEDES = [
  ['Charla Meridiano', 2, 19, 30], ['Charla Antares', 3, 19, 30],
  ['Charla Liberia', 3, 19, 30], ['Charla Guápiles', 3, 19, 0],
  ['Charla Cartago', 3, 19, 30], ['Charla Pérez Zeledón', 3, 19, 0],
  ['Charla Potrero', 4, 19, 30], ['Charla Alajuela', 4, 19, 30],
  ['Charla Pedregal', 3, 19, 30], ['Charla Pedregal Home', 4, 19, 30],
]

/** El instante, en hora de Costa Rica (UTC−6), de hace `semanas` semanas. */
function cuando(semanas, diaSemana, hora, minuto) {
  const hoy = new Date()
  const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()))
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() - diaSemana + 7) % 7 - semanas * 7)
  // +6 porque Costa Rica es UTC−6: las 19:30 de acá son las 01:30 UTC del día
  // siguiente. Escribirlo así y no con `toISOString()` sobre una fecha local es
  // lo que evita el corrimiento de siempre.
  d.setUTCHours(hora + 6, minuto, 0, 0)
  return d.toISOString()
}

;(async () => {
  const url = process.env.SUPABASE_DB_URL
  if (!url) { console.error('✗ Falta SUPABASE_DB_URL'); process.exit(1) }
  const local = url.includes('localhost') || url.includes('127.0.0.1')
  const c = new Client({ connectionString: url, ssl: local ? undefined : { rejectUnauthorized: false } })
  await c.connect()

  let creadas = 0, repetidas = 0
  for (let s = 1; s <= SEMANAS; s++) {
    for (const [titulo, dia, h, m] of SEDES) {
      const inicio = cuando(s, dia, h, m)
      // Idempotente por (título, día): correrlo dos veces no duplica.
      const ya = await c.query(
        `select 1 from events where title=$1 and starts_at::date = $2::timestamptz::date`, [titulo, inicio])
      if (ya.rowCount) { repetidas++; continue }
      await c.query(
        `insert into events (title, description, event_type, starts_at, ends_at,
                             is_public, is_active, status)
         values ($1,$2,'charla',$3,$4,true,false,'finished')`,
        [titulo, 'Charla realizada — historial sembrado para staging (INF-1).',
         inicio, new Date(Date.parse(inicio) + 2 * 3600_000).toISOString()])
      creadas++
    }
  }
  console.log(`  ${creadas} charlas pasadas creadas${repetidas ? ` · ${repetidas} ya estaban` : ''} (${SEMANAS} semanas × ${SEDES.length} sedes)`)
  await c.end()
})().catch(e => { console.error('✗', e.message); process.exit(1) })
