/**
 * Importa históricos de asistencia en FORMATO LARGO (una fila por asistencia),
 * distinto al ancho de seed-event-attendance.ts. Lee los 19 .xlsx de
 * scripts/data/BBDD_Asistencia/ (uno por sede/grupo), hoja "Table1".
 *
 * Columnas: Attendee, Ind ID, Last Attended, Group, Date meeting, Value.
 *   · Cada fila = una asistencia individual (Value siempre 1).
 *   · Group       = nombre de la sede/grupo (Alajuela, Cartago, Entre Mujeres…).
 *   · Date meeting = fecha de la charla (datetime, desde 2020).
 *   · Match del miembro: "Ind ID" → members.external_id (= Individual ID de PCO).
 *   · Se ignora cualquier hoja que no sea "Table1" (p.ej. "THEOS Place").
 *
 * Eventos: uno por (Group, fecha). title = Group VERBATIM (así quedaron los del
 * import ancho previo: "Alajuela", "Entre Mujeres"…; NO "Charla Alajuela", o la
 * dedup no agarraría y duplicaría el solapamiento). event_type por classifyEventType
 * (mismo criterio que el import ancho → sedes=charla; Entre Mujeres/Colegiales/
 * Youth/United Este=social). starts_at = fecha + hora real si la trae, si no 19:00
 * hora CR. is_active=false, is_public=true, status='finalizado', description=IMPORT_DESC.
 *
 * Idempotencia (clave por el solapamiento nov 2025–may 2026 con imports previos):
 *   · Eventos: dedup contra los que ya tienen IMPORT_DESC por (title + DÍA), no por
 *     timestamp exacto — el export largo y el ancho pueden codificar la hora distinto
 *     y un grupo se reúne una vez por día. Reúsa el existente; no duplica.
 *   · Check-ins: dedup por (event_id, member_id).
 *
 * Privacidad: datos confidenciales. La carpeta va en scripts/data/ (gitignored),
 * NO se commitea. El log imprime SOLO conteos (nunca nombres). Sin match → Ind ID
 * (no nombre) en scripts/output/attendance-long-no-match.csv.
 *
 * Dry-run (no escribe nada):  npx tsx scripts/seed-attendance-long.ts --dry-run
 * Ejecución real:             npx tsx scripts/seed-attendance-long.ts
 * Carpeta alterna:            npx tsx scripts/seed-attendance-long.ts <carpeta> [--dry-run]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')
const dirArg = process.argv.slice(2).find(a => !a.startsWith('--'))
const DATA_DIR = dirArg
  ? new URL(`./${dirArg.replace(/^scripts\//, '').replace(/^\.\//, '')}/`, import.meta.url)
  : new URL('./data/BBDD_Asistencia/', import.meta.url)
const SHEET = 'Table1'

for (const f of ['../.env.local', '../.env']) {
  try {
    const t = readFileSync(new URL(f, import.meta.url), 'utf8')
    for (const line of t.split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
  } catch { /* */ }
}
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!,
  { auth: { persistSession: false } },
)

const IMPORT_DESC = 'Importado de histórico de asistencia'

const str = (v: unknown): string => (v == null ? '' : String(v).trim())
const extId = (v: unknown): string => {
  if (typeof v === 'number') return String(Math.trunc(v))
  return str(v).replace(/\.0$/, '')
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Misma clasificación que el import ancho: sedes → charla; Campa → campamento;
// Kids → social; resto (Entre Mujeres, Colegiales, Youth, United Este…) → social.
const SEDES = [
  'pro oeste', 'pro este', 'perez zeledon', 'liberia', 'cartago', 'guapiles',
  'heredia', 'alajuela', 'potrero', 'theos home', 'united', 'madrid', 'life este',
]
function classifyEventType(title: string): 'charla' | 'campamento' | 'social' {
  const t = stripAccents(title).toLowerCase().trim()
  if (t.startsWith('campa')) return 'campamento'
  if (t.startsWith('kids') || t.includes('kids&teens')) return 'social'
  if (SEDES.some(s => t.includes(s))) return 'charla'
  return 'social'
}

// "Date meeting" → {day:'YYYY-MM-DD', startsAt:ISO con -06:00}. Si no trae hora
// (medianoche/sin tiempo) usa 19:00 hora CR.
function parseMeetingDate(v: unknown): { day: string; startsAt: string } | null {
  let y: number, mo: number, d: number, h: number, mi: number
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null
    // SheetJS arma las fechas en UTC; tomamos componentes UTC para no correr el día.
    y = v.getUTCFullYear(); mo = v.getUTCMonth() + 1; d = v.getUTCDate()
    h = v.getUTCHours(); mi = v.getUTCMinutes()
  } else {
    const s = str(v)
    if (!s) return null
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/)
    // PCO es plataforma gringa: las fechas texto vienen MM/DD/YYYY (mes primero).
    const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{2}):(\d{2}))?/)
    if (iso) {
      y = +iso[1]; mo = +iso[2]; d = +iso[3]; h = iso[4] ? +iso[4] : 0; mi = iso[5] ? +iso[5] : 0
    } else if (mdy) {
      mo = +mdy[1]; d = +mdy[2]; y = +mdy[3]; h = mdy[4] ? +mdy[4] : 0; mi = mdy[5] ? +mdy[5] : 0
    } else {
      const dt = new Date(s)
      if (isNaN(dt.getTime())) return null
      y = dt.getUTCFullYear(); mo = dt.getUTCMonth() + 1; d = dt.getUTCDate(); h = dt.getUTCHours(); mi = dt.getUTCMinutes()
    }
  }
  const day = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const noTime = h === 0 && mi === 0
  const hh = noTime ? '19' : String(h).padStart(2, '0')
  const mm = noTime ? '00' : String(mi).padStart(2, '0')
  return { day, startsAt: `${day}T${hh}:${mm}:00-06:00` }
}

// Día calendario en hora CR (UTC-6). Sin esto, un evento de las 19:00 CR (01:00
// UTC del día siguiente) caería en otro día al releer y se recrearía → duplicados.
const dayKeyFromIso = (iso: string): string =>
  new Date(Date.parse(iso) - 6 * 3600 * 1000).toISOString().slice(0, 10)

type EventPlan = { title: string; day: string; startsAt: string; eventType: string }

async function main() {
  if (!existsSync(DATA_DIR)) {
    console.error(`No se encontró ${DATA_DIR.pathname}`)
    console.error('Descomprimí el zip en scripts/data/BBDD_Asistencia/ (gitignored, datos confidenciales).')
    process.exit(1)
  }
  const files = readdirSync(DATA_DIR).filter(f => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~$'))
  if (!files.length) { console.error(`No hay .xlsx en ${DATA_DIR.pathname}`); process.exit(1) }
  console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}Archivos: ${files.length}`)

  // ── Leer todas las filas de todas las hojas "Table1" ──
  type Row = { indId: string; group: string; day: string; startsAt: string }
  const rows: Row[] = []
  let skippedNoGroup = 0, skippedNoDate = 0, skippedNoSheet = 0, totalRaw = 0
  const groups = new Set<string>()
  for (const f of files) {
    const wb = XLSX.read(readFileSync(join(DATA_DIR.pathname, f)), { type: 'buffer', cellDates: true })
    const sheet = wb.Sheets[SHEET]
    if (!sheet) { skippedNoSheet++; console.error(`  · ${f}: sin hoja "${SHEET}" (hojas: ${wb.SheetNames.join(', ')}) — saltado`); continue }
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true })
    totalRaw += data.length
    for (const r of data) {
      const group = str(r['Group'])
      const parsed = parseMeetingDate(r['Date meeting'])
      if (!group) { skippedNoGroup++; continue }
      if (!parsed) { skippedNoDate++; continue }
      groups.add(group)
      rows.push({ indId: extId(r['Ind ID']), group, day: parsed.day, startsAt: parsed.startsAt })
    }
  }
  console.log(`Filas leídas: ${totalRaw.toLocaleString('es-CR')} · válidas: ${rows.length.toLocaleString('es-CR')}`)
  if (skippedNoGroup || skippedNoDate || skippedNoSheet)
    console.log(`  saltadas → sin Group: ${skippedNoGroup} · sin fecha: ${skippedNoDate} · sin hoja Table1: ${skippedNoSheet}`)
  console.log(`Grupos distintos: ${groups.size}`)
  const byType: Record<string, number> = {}
  for (const g of groups) { const t = classifyEventType(g); byType[t] = (byType[t] ?? 0) + 1 }
  console.log(`Clasificación de grupos: ${JSON.stringify(byType)}`)

  // ── Eventos únicos (Group, día) ──
  const planByKey = new Map<string, EventPlan>() // `${title}|${day}`
  for (const r of rows) {
    const key = `${r.group}|${r.day}`
    if (!planByKey.has(key))
      planByKey.set(key, { title: r.group, day: r.day, startsAt: r.startsAt, eventType: classifyEventType(r.group) })
  }
  console.log(`Eventos únicos (grupo, día): ${planByKey.size.toLocaleString('es-CR')}`)

  // ── Miembros: external_id → uuid ──
  const extToId = new Map<string, string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('members').select('id, external_id')
      .not('external_id', 'is', null).order('id').range(from, from + 999)
    if (error) throw error
    for (const m of data as Array<{ id: string; external_id: string }>) extToId.set(m.external_id, m.id)
    if (data.length < 1000) break
  }
  console.log(`Miembros con external_id: ${extToId.size.toLocaleString('es-CR')}`)

  // ── Eventos ya importados (idempotencia) por (title|día) ──
  const existingByDay = new Map<string, string>() // `${title}|${day}` → event_id
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('events').select('id, title, starts_at')
      .eq('description', IMPORT_DESC).order('id').range(from, from + 999)
    if (error) throw error
    for (const e of data as Array<{ id: string; title: string; starts_at: string }>)
      existingByDay.set(`${e.title}|${dayKeyFromIso(e.starts_at)}`, e.id)
    if (data.length < 1000) break
  }
  console.log(`Eventos de imports previos: ${existingByDay.size.toLocaleString('es-CR')}`)

  // ── Crear/reusar eventos ──
  let created = 0, reused = 0
  const eventIdByKey = new Map<string, string>()
  for (const [key, plan] of planByKey) {
    const existing = existingByDay.get(key)
    if (existing) { eventIdByKey.set(key, existing); reused++; continue }
    if (DRY_RUN) { eventIdByKey.set(key, `dry-${key}`); created++; continue }
    const { data, error } = await supabase.from('events').insert({
      title: plan.title,
      event_type: plan.eventType,
      starts_at: plan.startsAt,
      ends_at: null,
      is_recurring: false,
      is_public: true,
      is_active: false,
      status: 'finished',
      description: IMPORT_DESC,
    }).select('id').single()
    if (error) { console.error(`✗ Evento "${plan.title}" ${plan.day} falló: ${error.message} — continuando…`); continue }
    const id = (data as { id: string }).id
    eventIdByKey.set(key, id)
    existingByDay.set(key, id) // por si otra fila repite la clave
    created++
  }
  console.log(`Eventos → crear: ${created.toLocaleString('es-CR')} · reusar: ${reused.toLocaleString('es-CR')}`)

  // ── Check-ins existentes (dedup) de los eventos reales involucrados ──
  const existingCheckins = new Set<string>() // `${event_id}|${member_id}`
  const realEventIds = Array.from(eventIdByKey.values()).filter(id => !id.startsWith('dry-'))
  for (let i = 0; i < realEventIds.length; i += 100) {
    const slice = realEventIds.slice(i, i + 100)
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('event_checkins').select('event_id, member_id')
        .in('event_id', slice).order('id').range(from, from + 999)
      if (error) throw error
      for (const c of data as Array<{ event_id: string; member_id: string | null }>)
        if (c.member_id) existingCheckins.add(`${c.event_id}|${c.member_id}`)
      if (data.length < 1000) break
    }
  }

  // ── Construir check-ins ──
  type Checkin = { event_id: string; member_id: string; checked_in_at: string; method: string; notes: string }
  const checkins: Checkin[] = []
  const noMatch = new Map<string, number>() // ind_id → veces (sin nombre)
  let dupes = 0, badId = 0
  for (const r of rows) {
    const eventId = eventIdByKey.get(`${r.group}|${r.day}`)
    if (!eventId) continue
    if (!/^\d+$/.test(r.indId)) { badId++; continue }
    const memberId = extToId.get(r.indId)
    if (!memberId) { noMatch.set(r.indId, (noMatch.get(r.indId) ?? 0) + 1); continue }
    const k = `${eventId}|${memberId}`
    if (existingCheckins.has(k)) { dupes++; continue }
    existingCheckins.add(k)
    checkins.push({ event_id: eventId, member_id: memberId, checked_in_at: r.startsAt, method: 'manual', notes: 'import histórico' })
  }

  console.log('\n── Plan ──')
  console.log(`  Eventos a crear:        ${created.toLocaleString('es-CR')}`)
  console.log(`  Eventos a reusar:       ${reused.toLocaleString('es-CR')}`)
  console.log(`  Check-ins a insertar:   ${checkins.length.toLocaleString('es-CR')}`)
  console.log(`  Duplicados saltados:    ${dupes.toLocaleString('es-CR')}`)
  console.log(`  Ind ID inválido:        ${badId.toLocaleString('es-CR')}`)
  console.log(`  Sin match (personas):   ${noMatch.size.toLocaleString('es-CR')}`)

  if (noMatch.size) {
    mkdirSync(new URL('./output/', import.meta.url), { recursive: true })
    const csv = ['ind_id,asistencias', ...Array.from(noMatch.entries()).map(([id, n]) => `${id},${n}`)].join('\n')
    writeFileSync(new URL('./output/attendance-long-no-match.csv', import.meta.url), csv)
    console.log(`  → sin match en scripts/output/attendance-long-no-match.csv (solo Ind ID)`)
  }

  if (DRY_RUN) { console.log('\n[DRY-RUN] No se escribió nada en la BD.'); return }

  // ── Insertar check-ins en batches de 200 ──
  let inserted = 0, failedBatches = 0
  for (let i = 0; i < checkins.length; i += 200) {
    const batch = checkins.slice(i, i + 200)
    const { error } = await supabase.from('event_checkins').insert(batch)
    if (error) { failedBatches++; console.error(`✗ Batch ${i / 200 + 1} falló: ${error.message} — continuando…`); continue }
    inserted += batch.length
    if (inserted % 4000 < 200 || inserted === checkins.length)
      console.log(`  ✓ check-ins insertados: ${inserted.toLocaleString('es-CR')} / ${checkins.length.toLocaleString('es-CR')}`)
  }

  console.log('\n── Resumen ──')
  console.log(`  Eventos creados:      ${created.toLocaleString('es-CR')}`)
  console.log(`  Eventos reusados:     ${reused.toLocaleString('es-CR')}`)
  console.log(`  Check-ins insertados: ${inserted.toLocaleString('es-CR')}`)
  console.log(`  Duplicados saltados:  ${dupes.toLocaleString('es-CR')}`)
  console.log(`  Sin match:            ${noMatch.size.toLocaleString('es-CR')} personas`)
  if (failedBatches) console.log(`  Batches fallidos:     ${failedBatches}`)
}

main().catch(e => { console.error('Error fatal:', e); process.exit(1) })
