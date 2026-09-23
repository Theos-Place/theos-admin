/**
 * INF-1 · Charlas YA REALIZADAS, para que un ambiente nuevo tenga historia.
 *
 * EL ESLABÓN QUE FALTABA. `seed-datos-de-prueba` cuelga asistencia de charlas de
 * los últimos 170 días y se niega si hay menos de seis. En producción existen
 * porque llevan meses sucediendo; en una base recién creada no hay ninguna, y
 * `seed-charlas` solo crea las de ESTA semana. Ahí se caía el arranque.
 *
 * No se toca `seed-charlas.ts`: ése crea las charlas reales que la gente ve en
 * el calendario, y meterle semanas hacia atrás sería ensuciar el calendario de
 * producción con eventos inventados.
 *
 * Lo que genera es a propósito mínimo: el evento y nada más. Quién asistió lo
 * pone `seed-datos-de-prueba` con sus personas [prueba].
 *
 *   npx tsx scripts/staging/sembrar-charlas-pasadas.ts [semanas]
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const f of ['.env', '.env.local']) {
  try {
    for (const l of readFileSync(f, 'utf8').split('\n')) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* sin archivo */ }
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY) { console.error('✗ Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

const db = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const SEMANAS = Number(process.argv[2] ?? 12)

/** Sede → [día de la semana (0=domingo), hora, minuto], igual que seed-charlas. */
const SEDES: Array<[string, number, number, number]> = [
  ['Charla Meridiano', 2, 19, 30], ['Charla Antares', 3, 19, 30],
  ['Charla Liberia', 3, 19, 30], ['Charla Guápiles', 3, 19, 0],
  ['Charla Cartago', 3, 19, 30], ['Charla Pérez Zeledón', 3, 19, 0],
  ['Charla Potrero', 4, 19, 30], ['Charla Alajuela', 4, 19, 30],
  ['Charla Pedregal', 3, 19, 30], ['Charla Pedregal Home', 4, 19, 30],
]

/** El instante, en hora de Costa Rica, de hace `semanas` semanas. */
function cuando(semanas: number, diaSemana: number, hora: number, minuto: number): string {
  const hoy = new Date()
  const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()))
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() - diaSemana + 7) % 7) - semanas * 7)
  // +6 porque Costa Rica es UTC−6: las 19:30 de acá son las 01:30 UTC del día
  // siguiente. Escribirlo así, y no con `toISOString()` sobre una fecha local,
  // es lo que evita el corrimiento de siempre.
  d.setUTCHours(hora + 6, minuto, 0, 0)
  return d.toISOString()
}

async function main() {
  // `status` válido es 'finished', NO 'finalizado' — el CHECK de la tabla lo
  // rechaza, y me lo rechazó.
  const filas = []
  for (let s = 1; s <= SEMANAS; s++) {
    for (const [title, dia, h, m] of SEDES) {
      const inicio = cuando(s, dia, h, m)
      filas.push({
        title,
        description: 'Charla realizada — historial sembrado para staging (INF-1).',
        event_type: 'charla',
        starts_at: inicio,
        ends_at: new Date(Date.parse(inicio) + 2 * 3600_000).toISOString(),
        is_public: true, is_active: false, status: 'finished',
      })
    }
  }

  // Idempotente: se saltan las que ya existan con el mismo título y día.
  const desde = filas[filas.length - 1].starts_at
  const { data: ya } = await db.from('events')
    .select('title, starts_at').eq('event_type', 'charla').gte('starts_at', desde)
  const vistas = new Set((ya ?? []).map(e => `${e.title}|${String(e.starts_at).slice(0, 10)}`))
  const nuevas = filas.filter(f => !vistas.has(`${f.title}|${f.starts_at.slice(0, 10)}`))

  if (nuevas.length) {
    const { error } = await db.from('events').insert(nuevas)
    if (error) { console.error('✗', error.message); process.exit(1) }
  }
  const repetidas = filas.length - nuevas.length
  console.log(`  ${nuevas.length} charlas pasadas creadas${repetidas ? ` · ${repetidas} ya estaban` : ''} (${SEMANAS} semanas × ${SEDES.length} sedes)`)
}
main().catch(e => { console.error('✗', e instanceof Error ? e.message : e); process.exit(1) })
