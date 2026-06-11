/**
 * Importa históricos de asistencia a eventos desde un CSV (una columna por
 * evento con encabezado "[Nombre] [dd/mm/yyyy] [HH:MM|All Day]", celda 1 =
 * asistió). Crea los eventos (idempotente) y los check-ins.
 *
 * Uso:
 *   npx tsx scripts/seed-event-attendance.ts <ruta.csv> [--apply]
 *   (sin ruta usa scripts/data/asistencia-eventos-mensuales.csv)
 *
 * - Match del miembro por members.external_id (= "Ind ID" de PCO).
 * - event_type por nombre del evento (ids del catálogo event_types):
 *     · empieza con "Campa" → campamento; "Kids"/"Kids&Teens" → social
 *     · contiene una sede (Pro Oeste, Heredia, …) → charla
 *     · todo lo demás → social
 * - Idempotencia: solo dedup contra eventos con description de importación
 *   (NO reúsa charlas recurrentes del sistema) por título + starts_at; los
 *   check-ins dedup por (event_id, member_id). Correr abril y mayo no duplica.
 * - Sin match → scripts/output/attendance-no-match-<archivo>.csv.
 *
 * Dry-run por defecto. Aplicar: agregar --apply.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { basename } from 'node:path'
import { parse } from 'csv-parse/sync'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const csvArg = process.argv.slice(2).find(a => !a.startsWith('--')) ?? 'scripts/data/asistencia-eventos-mensuales.csv'

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
const FIXED_COLS = new Set(['Attendee', 'Campus', 'Last Attended', 'TODAY', 'Total Attendance', 'Ind ID'])

// "Mujeres de Fe 04/09/2015 19:00" | "Campa Hombres 24/07/2021 All Day" (+ sufijo .1 de pandas)
const COL_RE = /^(.*?)\s+(\d{2})\/(\d{2})\/(\d{4})\s+(All Day|\d{2}:\d{2})(?:\.\d+)?$/

type ParsedEvent = { title: string; startsAt: string; key: string }

function parseEventColumn(col: string): ParsedEvent | null {
  const m = col.trim().match(COL_RE)
  if (!m) return null
  const [, title, dd, mm, yyyy, time] = m
  const hhmm = time === 'All Day' ? '08:00' : time
  // Hora local de Costa Rica (UTC-6).
  const startsAt = `${yyyy}-${mm}-${dd}T${hhmm}:00-06:00`
  return { title: title.trim(), startsAt, key: `${title.trim()}|${yyyy}-${mm}-${dd}|${hhmm}` }
}

// ── Clasificación de event_type por nombre ────────────────────────────────────
const SEDES = [
  'pro oeste', 'pro este', 'perez zeledon', 'liberia', 'cartago', 'guapiles',
  'heredia', 'alajuela', 'potrero', 'theos home', 'united', 'madrid', 'life este',
]

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function classifyEventType(title: string): 'charla' | 'campamento' | 'social' {
  const t = stripAccents(title).toLowerCase().trim()
  // Excepciones primero: Campa/Kids nunca son charla aunque mencionen una sede
  // (ej. "Campa Madrid", "Kids Heredia").
  if (t.startsWith('campa')) return 'campamento'
  if (t.startsWith('kids') || t.includes('kids&teens')) return 'social'
  if (SEDES.some(s => t.includes(s))) return 'charla'
  return 'social'
}

async function main() {
  const raw = readFileSync(csvArg, 'utf8')
  const records: Record<string, string>[] = parse(raw, { columns: true, bom: true, skip_empty_lines: true, trim: true })
  const header = Object.keys(records[0] ?? {})
  console.log(`CSV ${csvArg}: ${records.length.toLocaleString()} filas · ${header.length} columnas`)

  // ── Columnas de evento (deduplicadas por title+fecha+hora; sufijos .N unidos) ──
  const eventCols = new Map<string, { event: ParsedEvent; cols: string[] }>()
  const unparsed: string[] = []
  for (const col of header) {
    if (FIXED_COLS.has(col)) continue
    const ev = parseEventColumn(col)
    if (!ev) { unparsed.push(col); continue }
    const entry = eventCols.get(ev.key)
    if (entry) entry.cols.push(col)
    else eventCols.set(ev.key, { event: ev, cols: [col] })
  }
  if (unparsed.length) {
    console.error('✗ Columnas que no parsean como evento (revisar antes de importar):')
    for (const c of unparsed) console.error('  ·', c)
    process.exit(1)
  }
  console.log(`Eventos únicos: ${eventCols.size}`)
  // resumen de clasificación
  const byType: Record<string, number> = {}
  for (const { event } of eventCols.values()) {
    const ty = classifyEventType(event.title)
    byType[ty] = (byType[ty] ?? 0) + 1
  }
  console.log('Clasificación:', JSON.stringify(byType))

  // ── Filas válidas: Ind ID numérico ──
  const validRows = records.filter(r => /^\d+$/.test((r['Ind ID'] ?? '').trim()))
  console.log(`Filas válidas: ${validRows.length.toLocaleString()} (excluidas ${records.length - validRows.length})`)

  // ── Miembros: external_id → uuid ──
  const extToId = new Map<string, string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('members').select('id, external_id')
      .not('external_id', 'is', null)
      .order('id')
      .range(from, from + 999)
    if (error) throw error
    for (const m of data as Array<{ id: string; external_id: string }>) extToId.set(m.external_id, m.id)
    if (data.length < 1000) break
  }
  console.log(`Miembros con external_id: ${extToId.size.toLocaleString()}`)

  // ── Eventos ya importados (idempotencia, SOLO los de la descripción de import) ──
  const existingEvents = new Map<string, string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('events').select('id, title, starts_at')
      .eq('description', IMPORT_DESC)
      .order('id')
      .range(from, from + 999)
    if (error) throw error
    for (const e of data as Array<{ id: string; title: string; starts_at: string }>) {
      existingEvents.set(`${e.title}|${new Date(e.starts_at).toISOString()}`, e.id)
    }
    if (data.length < 1000) break
  }
  console.log(`Eventos de imports previos: ${existingEvents.size}`)

  // ── Crear/reusar eventos ──
  let created = 0, reused = 0
  const eventIds = new Map<string, string>()
  for (const { event } of eventCols.values()) {
    const isoKey = `${event.title}|${new Date(event.startsAt).toISOString()}`
    const existing = existingEvents.get(isoKey)
    if (existing) { eventIds.set(event.key, existing); reused++; continue }
    if (!APPLY) { eventIds.set(event.key, `dry-${event.key}`); created++; continue }
    const { data, error } = await supabase.from('events').insert({
      title: event.title,
      event_type: classifyEventType(event.title),
      starts_at: event.startsAt,
      ends_at: null,
      is_recurring: false,
      is_public: true,
      is_active: false,
      status: 'finished',
      description: IMPORT_DESC,
    }).select('id').single()
    if (error) {
      console.error(`✗ Evento "${event.title} ${event.startsAt}" falló: ${error.message} — continuando…`)
      continue
    }
    eventIds.set(event.key, (data as { id: string }).id)
    created++
  }
  console.log(`Eventos → creados: ${created} · reusados: ${reused}`)

  // ── Check-ins existentes de estos eventos (dedup) ──
  const existingCheckins = new Set<string>()
  const realEventIds = Array.from(eventIds.values()).filter(id => !id.startsWith('dry-'))
  for (let i = 0; i < realEventIds.length; i += 100) {
    const slice = realEventIds.slice(i, i + 100)
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('event_checkins').select('event_id, member_id')
        .in('event_id', slice)
        .order('id')
        .range(from, from + 999)
      if (error) throw error
      for (const c of data as Array<{ event_id: string; member_id: string | null }>) {
        if (c.member_id) existingCheckins.add(`${c.event_id}|${c.member_id}`)
      }
      if (data.length < 1000) break
    }
  }

  // ── Construir check-ins ──
  type Checkin = { event_id: string; member_id: string; checked_in_at: string; method: string; notes: string }
  const checkins: Checkin[] = []
  const noMatch = new Map<string, { ind_id: string; name: string; events: number }>()
  let dupes = 0

  let evIdx = 0
  for (const { event, cols } of eventCols.values()) {
    evIdx++
    const eventId = eventIds.get(event.key)
    if (!eventId) continue
    for (const row of validRows) {
      const val = cols.map(c => (row[c] ?? '').trim())
      if (!val.includes('1')) continue
      if (val.some(v => v !== '0' && v !== '1' && v !== '')) continue
      const indId = (row['Ind ID'] ?? '').trim()
      const memberId = extToId.get(indId)
      if (!memberId) {
        const e = noMatch.get(indId) ?? { ind_id: indId, name: row['Attendee'] ?? '', events: 0 }
        e.events++
        noMatch.set(indId, e)
        continue
      }
      const key = `${eventId}|${memberId}`
      if (existingCheckins.has(key)) { dupes++; continue }
      existingCheckins.add(key)
      checkins.push({
        event_id: eventId,
        member_id: memberId,
        checked_in_at: event.startsAt,
        method: 'manual',
        notes: 'import histórico',
      })
    }
    if (evIdx % 25 === 0 || evIdx === eventCols.size) {
      console.log(`Evento ${evIdx}/${eventCols.size} · checkins a insertar: ${checkins.length.toLocaleString()}`)
    }
  }

  console.log(`\nPlan: checkins ${checkins.length.toLocaleString()} · duplicados saltados ${dupes.toLocaleString()} · personas sin match ${noMatch.size}`)

  if (noMatch.size) {
    mkdirSync(new URL('./output/', import.meta.url), { recursive: true })
    const outName = `attendance-no-match-${basename(csvArg, '.csv')}.csv`
    const csv = ['ind_id,name,eventos_afectados', ...Array.from(noMatch.values()).map(n => `${n.ind_id},"${n.name.replace(/"/g, '""')}",${n.events}`)].join('\n')
    writeFileSync(new URL(`./output/${outName}`, import.meta.url), csv)
    console.log(`Sin match guardados en scripts/output/${outName}`)
  }

  if (!APPLY) {
    console.log('\nDRY-RUN: no se insertó nada. Corré con --apply para aplicar.')
    return
  }

  // ── Insertar check-ins en batches de 200 ──
  let inserted = 0, failedBatches = 0
  for (let i = 0; i < checkins.length; i += 200) {
    const batch = checkins.slice(i, i + 200)
    const { error } = await supabase.from('event_checkins').insert(batch)
    if (error) {
      failedBatches++
      console.error(`✗ Batch ${i / 200 + 1} falló: ${error.message} — continuando…`)
      continue
    }
    inserted += batch.length
    if (inserted % 2000 < 200 || inserted === checkins.length) {
      console.log(`✓ checkins insertados: ${inserted.toLocaleString()} / ${checkins.length.toLocaleString()}`)
    }
  }

  console.log('\n── Resumen ──')
  console.log(`Eventos creados:     ${created}`)
  console.log(`Eventos reusados:    ${reused}`)
  console.log(`Checkins insertados: ${inserted.toLocaleString()}`)
  console.log(`Duplicados saltados: ${dupes.toLocaleString()}`)
  console.log(`Sin match:           ${noMatch.size} personas`)
  if (failedBatches) console.log(`Batches fallidos:    ${failedBatches}`)
}

main().catch(e => { console.error('Error fatal:', e); process.exit(1) })
