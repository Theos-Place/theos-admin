/* Reimport de asistencia a charlas desde los Excel de BBDD_Asistencia (mismos
 * datos del Power BI). Crea 1 evento por (sede, fecha) y 1 check-in por fila,
 * mapeando Ind ID (PCO) -> members.external_id -> member_id.
 *
 * Uso:
 *   node scripts/import-charla-attendance.cjs         # DRY RUN (no escribe)
 *   node scripts/import-charla-attendance.cjs --run   # ejecuta inserts
 *
 * Pre-requisito: las charlas viejas ya deben estar borradas (se hace aparte).
 */
const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')
const { createClient } = require('@supabase/supabase-js')

const RUN = process.argv.includes('--run')
const DIR = path.join(__dirname, 'data/BBDD_Asistencia')

// Archivo -> título de evento (nombre de sede). Conocidas -> canónico "Charla X";
// especiales del PBI se guardan con su nombre limpio (sin el '*').
const TITLE_BY_FILE = {
  'H_ProOeste(Meridiano).xlsx': 'Charla Meridiano',
  'H_ProEste(Antares).xlsx': 'Charla Antares',
  'H_United.xlsx': 'Charla United',
  'H_Heredia.xlsx': 'Charla Heredia',
  'H_Alajuela.xlsx': 'Charla Alajuela',
  'H_Liberia.xlsx': 'Charla Liberia',
  'H_Madrid.xlsx': 'Charla Madrid',
  'H_Cartago.xlsx': 'Charla Cartago',
  'H_Guapiles.xlsx': 'Charla Guápiles',
  'H_Potrero.xlsx': 'Charla Potrero',
  'H_Pérez Zeledón.xlsx': 'Charla Pérez Zeledón',
  'H_LifeEscalante.xlsx': 'Charla Life Escalante',
  'H_Home.xlsx': 'Charla Home',
  'H_HerediaYouth.xlsx': 'Heredia Youth',
  'H_UnitedYouth.xlsx': 'United Youth',
  'United Este-.xlsx': 'United Este',
  'Youth United Este.xlsx': 'Youth United Este',
  'Colegiales.xlsx': 'Colegiales',
  'Entre Mujeres.xlsx': 'Entre Mujeres',
}

function loadEnv() {
  const env = {}
  for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
    const i = line.indexOf('='); if (i < 0) continue
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return env
}

const pad = n => String(n).padStart(2, '0')
/** "M/D/YY" o "M/D/YYYY" -> "YYYY-MM-DD" (CR), o null si no parsea. */
function parseDate(s) {
  const m = String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) return null
  let [, mm, dd, yy] = m
  let year = yy.length <= 2 ? 2000 + parseInt(yy) : parseInt(yy)
  return `${year}-${pad(parseInt(mm))}-${pad(parseInt(dd))}`
}

async function main() {
  const env = loadEnv()
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  // 1. Mapa external_id -> member_id (paginado)
  console.log('Cargando miembros…')
  const extToId = new Map()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('members').select('id, external_id').range(from, from + 999)
    if (error) throw error
    for (const m of data) if (m.external_id) extToId.set(String(m.external_id).trim(), m.id)
    if (data.length < 1000) break
  }
  console.log('Miembros con external_id:', extToId.size)

  // 2. Parsear Excel -> eventos (sede,fecha) + check-ins (evento, member)
  const events = new Map() // key `${title}|${date}` -> {title, date}
  const checkins = new Map() // key `${title}|${date}|${memberId}` -> {title,date,memberId}
  const unmatched = new Map() // indId -> count
  let totalRows = 0, badDate = 0

  // Mapa tolerante a normalización unicode (macOS devuelve nombres en NFD).
  const titleByNorm = new Map(Object.entries(TITLE_BY_FILE).map(([k, v]) => [k.normalize('NFC'), v]))
  for (const file of fs.readdirSync(DIR).filter(f => f.endsWith('.xlsx'))) {
    const title = titleByNorm.get(file.normalize('NFC'))
    if (!title) { console.warn('SIN MAPEO de título:', file); continue }
    const wb = XLSX.readFile(path.join(DIR, file))
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: false, defval: '' })
    for (const r of rows) {
      totalRows++
      const date = parseDate(r['Date meeting'])
      if (!date) { badDate++; continue }
      const ekey = `${title}|${date}`
      if (!events.has(ekey)) events.set(ekey, { title, date })
      const indId = String(r['Ind ID'] || '').trim()
      const memberId = extToId.get(indId)
      if (!memberId) { unmatched.set(indId, (unmatched.get(indId) || 0) + 1); continue }
      checkins.set(`${ekey}|${memberId}`, { ekey, memberId, date })
    }
  }

  const unmatchedRows = [...unmatched.values()].reduce((a, b) => a + b, 0)
  console.log('\n── RESUMEN ──')
  console.log('Filas leídas:', totalRows)
  console.log('Fechas inválidas:', badDate)
  console.log('Eventos a crear (sede×fecha):', events.size)
  console.log('Check-ins con match (dedup):', checkins.size)
  console.log('Ind IDs sin match:', unmatched.size, '→ filas afectadas:', unmatchedRows,
    `(${(unmatchedRows / totalRows * 100).toFixed(1)}%)`)

  if (!RUN) { console.log('\nDRY RUN — no se escribió nada. Corré con --run para ejecutar.'); return }

  // 3. Insertar eventos y mapear key -> id
  console.log('\nInsertando eventos…')
  const evArr = [...events.values()]
  const keyToEventId = new Map()
  for (let i = 0; i < evArr.length; i += 500) {
    const chunk = evArr.slice(i, i + 500).map(e => ({
      title: e.title, event_type: 'charla', starts_at: `${e.date}T12:00:00-06:00`,
    }))
    const { data, error } = await sb.from('events').insert(chunk).select('id, title, starts_at')
    if (error) throw error
    for (const row of data) {
      const d = row.starts_at.slice(0, 10)
      keyToEventId.set(`${row.title}|${d}`, row.id)
    }
  }
  console.log('Eventos insertados:', keyToEventId.size)

  // 4. Insertar check-ins (chunks chicos + reintento ante timeout)
  console.log('Insertando check-ins…')
  const ckArr = [...checkins.values()]
  let inserted = 0
  for (let i = 0; i < ckArr.length; i += 500) {
    const chunk = ckArr.slice(i, i + 500).map(c => ({
      event_id: keyToEventId.get(c.ekey), member_id: c.memberId,
      checked_in_at: `${c.date}T12:00:00-06:00`, method: 'manual',
    })).filter(c => c.event_id)
    let ok = false
    for (let attempt = 1; attempt <= 4 && !ok; attempt++) {
      const { error } = await sb.from('event_checkins').insert(chunk)
      if (!error) { ok = true; break }
      console.warn(`  chunk ${i} intento ${attempt} falló: ${error.message}`)
      await new Promise(r => setTimeout(r, 500 * attempt))
    }
    if (!ok) throw new Error(`No se pudo insertar el chunk en ${i}`)
    inserted += chunk.length
    if (i % 20000 === 0) console.log('  …', inserted)
  }
  console.log('Check-ins insertados:', inserted)
  console.log('\nLISTO.')
}

main().catch(e => { console.error(e); process.exit(1) })
