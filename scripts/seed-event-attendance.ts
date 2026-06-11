/**
 * Importa el histórico de asistencia a eventos esporádicos desde
 * scripts/data/asistencia-eventos-mensuales.csv (una columna por evento,
 * celda 1 = asistió). Crea los eventos (idempotente) y los check-ins.
 *
 * - Match del miembro por members.external_id (= "Ind ID" de PCO).
 * - event_type 'social': event_type es FK a event_types y 'actividad' no
 *   existe; 'social' (Actividad Social) es el tipo que corresponde.
 * - Eventos históricos: is_active=false y status='finished'.
 * - Sin match → scripts/output/attendance-no-match.csv (NO se insertan como guest).
 *
 * Dry-run por defecto. Aplicar: npx tsx scripts/seed-event-attendance.ts --apply
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')

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

async function main() {
  const raw = readFileSync(new URL('./data/asistencia-eventos-mensuales.csv', import.meta.url), 'utf8')
  const records: Record<string, string>[] = parse(raw, { columns: true, bom: true, skip_empty_lines: true, trim: true })
  const header = Object.keys(records[0] ?? {})
  console.log(`CSV: ${records.length.toLocaleString()} filas · ${header.length} columnas`)

  // ── Columnas de evento (deduplicadas por title+fecha+hora; sufijos .N unidos) ──
  const eventCols = new Map<string, { event: ParsedEvent; cols: string[] }>()
  const unparsed: string[] = []
  for (const col of header) {
    if (['Attendee', 'Campus', 'Last Attended', 'TODAY', 'Total Attendance', 'Ind ID'].includes(col)) continue
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
  console.log(`Eventos únicos: ${eventCols.size} (columnas de evento: ${header.length - 6})`)

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

  // ── Eventos ya importados (idempotencia): title + starts_at + descripción ──
  const existingEvents = new Map<string, string>() // `${title}|${starts_at}` → id
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
  console.log(`Eventos de import previos: ${existingEvents.size}`)

  // ── Crear/reusar eventos ──
  let created = 0, reused = 0
  const eventIds = new Map<string, string>() // key → event uuid
  for (const { event } of eventCols.values()) {
    const isoKey = `${event.title}|${new Date(event.startsAt).toISOString()}`
    const existing = existingEvents.get(isoKey)
    if (existing) { eventIds.set(event.key, existing); reused++; continue }
    if (!APPLY) { eventIds.set(event.key, `dry-${event.key}`); created++; continue }
    const { data, error } = await supabase.from('events').insert({
      title: event.title,
      event_type: 'social',
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
  const existingCheckins = new Set<string>() // `${event_id}|${member_id}`
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
      // columnas duplicadas (.1) unidas: asistió si CUALQUIERA marca 1
      const val = cols.map(c => (row[c] ?? '').trim())
      if (!val.includes('1')) continue
      if (val.some(v => v !== '0' && v !== '1' && v !== '')) continue // datos corruptos
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
    const csv = ['ind_id,name,eventos_afectados', ...Array.from(noMatch.values()).map(n => `${n.ind_id},"${n.name.replace(/"/g, '""')}",${n.events}`)].join('\n')
    writeFileSync(new URL('./output/attendance-no-match.csv', import.meta.url), csv)
    console.log('Sin match guardados en scripts/output/attendance-no-match.csv')
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
  console.log(`Sin match:           ${noMatch.size} personas (scripts/output/attendance-no-match.csv)`)
  if (failedBatches) console.log(`Batches fallidos:    ${failedBatches}`)
}

main().catch(e => { console.error('Error fatal:', e); process.exit(1) })
