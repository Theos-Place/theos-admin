/**
 * Seed de charlas semanales recurrentes (sedes Theos Place).
 * Datos reales. event_type='charla' (FK a event_types).
 * recurrence_rule en formato WEEKLY:XX que parsea la app.
 * Las horas se anclan a la semana actual con offset -06:00 (hora Costa Rica).
 *
 * Uso: npx tsx scripts/seed-charlas.ts
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

// Lunes de la semana actual (UTC) como ancla.
const now = new Date()
const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
const dow = monday.getUTCDay() // 0=Dom..6=Sab
const diffToMonday = (dow === 0 ? -6 : 1 - dow)
monday.setUTCDate(monday.getUTCDate() + diffToMonday)

const DAY_OFFSET: Record<string, number> = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6 }

// Devuelve ISO con offset -06:00 (Costa Rica) para fecha de esta semana + día + hora local.
function whenISO(day: string, hh: number, mm: number): string {
  const d = new Date(monday)
  d.setUTCDate(d.getUTCDate() + DAY_OFFSET[day])
  const yyyy = d.getUTCFullYear()
  const MM = String(d.getUTCMonth() + 1).padStart(2, '0')
  const DD = String(d.getUTCDate()).padStart(2, '0')
  const H = String(hh).padStart(2, '0')
  const M = String(mm).padStart(2, '0')
  return `${yyyy}-${MM}-${DD}T${H}:${M}:00-06:00`
}

type Charla = {
  title: string; description: string; location: string; location_url: string
  day: string; startH: number; startM: number; endH: number; endM: number
}

const CHARLAS: Charla[] = [
  { title: 'Charla Meridiano', description: 'Charla semanal sede Meridiano. Grupo +32.', location: 'Edificio Meridiano, Escazú', location_url: 'https://www.waze.com/live-map/directions?to=ll.9.942691,-84.152763', day: 'TUE', startH: 19, startM: 30, endH: 21, endM: 30 },
  { title: 'Charla Antares', description: 'Charla semanal sede Antares. Grupo +18.', location: 'Plaza Antares, San Pedro', location_url: 'https://waze.com/ul/hd1u0x3283', day: 'WED', startH: 19, startM: 30, endH: 21, endM: 30 },
  { title: 'Charla Liberia', description: 'Charla semanal sede Liberia. Grupo +18.', location: 'Donde Pipe, Bo. Los Angeles, Liberia', location_url: 'https://waze.com/ul/hd1ghrxnvn', day: 'WED', startH: 19, startM: 30, endH: 21, endM: 30 },
  { title: 'Charla Guápiles', description: 'Charla semanal sede Guápiles. Grupo +18.', location: 'Salón Pueblo en Fiesta, Guápiles', location_url: 'https://waze.com/ul/hd1u6jmwyc', day: 'WED', startH: 19, startM: 0, endH: 21, endM: 0 },
  { title: 'Charla Cartago', description: 'Charla semanal sede Cartago. Grupo +18.', location: 'Rancho Típico El Ensueño, Cartago', location_url: 'https://waze.com/ul/hd1u24ju5s', day: 'WED', startH: 19, startM: 30, endH: 21, endM: 30 },
  { title: 'Charla Pérez Zeledón', description: 'Charla semanal sede Pérez Zeledón. Grupo +18.', location: 'Casa Sindical SEC, 200m noroeste Hotel Luckys, Pérez Zeledón', location_url: 'https://www.waze.com/live-map/directions?to=ll.9.376938,-83.705027', day: 'WED', startH: 19, startM: 0, endH: 21, endM: 0 },
  { title: 'Charla Potrero', description: 'Charla semanal sede Potrero. Grupo +18.', location: 'Playa Penca, Tempate, Potrero', location_url: 'https://waze.com/ul/hd1g580v31', day: 'THU', startH: 19, startM: 30, endH: 21, endM: 30 },
  { title: 'Charla Alajuela', description: 'Charla semanal sede Alajuela. Grupo +18.', location: 'Lifehouse, Alajuela Centro', location_url: 'https://waze.com/ul/hd1u158h2e', day: 'THU', startH: 19, startM: 30, endH: 21, endM: 30 },
  { title: 'Charla Madrid', description: 'Charla semanal sede Madrid. Todas las edades.', location: 'MadHat, Madrid', location_url: 'https://maps.app.goo.gl/VoquA2tPCYk6MYLv7', day: 'SUN', startH: 11, startM: 30, endH: 13, endM: 30 },
  { title: 'Charla Pedregal', description: 'Charla semanal sede Pedregal. Todas las edades.', location: 'Pedregal', location_url: 'https://waze.com/ul/hd1u0u2xsj', day: 'WED', startH: 19, startM: 30, endH: 21, endM: 30 },
  { title: 'Charla Pedregal (Jóvenes)', description: 'Charla semanal sede Pedregal. Grupo 18–32.', location: 'Pedregal', location_url: 'https://waze.com/ul/hd1u0u2xsj', day: 'THU', startH: 19, startM: 30, endH: 21, endM: 30 },
  { title: 'Charla Pedregal (Domingo)', description: 'Charla semanal sede Pedregal. Todas las edades.', location: 'Pedregal', location_url: 'https://waze.com/ul/hd1u0u2xsj', day: 'SUN', startH: 11, startM: 0, endH: 13, endM: 0 },
]

async function main() {
  const rows = CHARLAS.map(c => ({
    title: c.title,
    description: c.description,
    event_type: 'charla',
    location: c.location,
    location_url: c.location_url,
    starts_at: whenISO(c.day, c.startH, c.startM),
    ends_at: whenISO(c.day, c.endH, c.endM),
    is_recurring: true,
    recurrence_rule: `WEEKLY:${c.day}`,
    is_public: true,
    is_active: true,
  }))

  const { data, error } = await supabase.from('events').insert(rows).select('id, title, starts_at')
  if (error) { console.error('ERROR:', error); process.exit(1) }
  console.log(`Insertadas ${data!.length} charlas:`)
  for (const r of data!) console.log(` - ${r.title}  (${r.starts_at})`)
}

main()
