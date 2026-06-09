/**
 * Importa el histórico de estudios (data-import/historico-estudios.csv) a study_enrollments.
 * - member por "Ind ID" → members.external_id (paginado)
 * - "Queue Name" → código de study_plan (QUEUE_MAP)
 * - crea un grupo "Histórico" por plan (study_enrollments exige group_id)
 * - status 'completed', completed_at/enrolled_at = "Due"
 * Dedup por (member, plan). Dry-run por defecto. Aplicar: --apply
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
for (const f of ['../.env.local', '../.env']) {
  try { const t = readFileSync(new URL(f, import.meta.url), 'utf8'); for (const l of t.split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') } } catch { /* */ }
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } })

// Queue Name (PCO) → código de plan en la BD. Solo los que existen en el catálogo.
const QUEUE_MAP: Record<string, string> = {
  'Nivel 1': 'N1', 'Nivel 2': 'N2', 'Nivel 3': 'N3', 'Nivel 4': 'N4',
  'Sirviendo como Jesús': 'SCJ',
  'Discípulos 1': 'DIS1', 'Discípulos 2': 'DIS2', 'Discipulos 3': 'DIS3', 'Discípulos 3': 'DIS3',
  'Panorama': 'PAN', 'Administrando el Dinero': 'AED', 'Matrimonios': 'MAT',
  'Religiones del Mundo': 'RDM', 'Evangelismo': 'EVM',
  '¿Cómo interpretar la Biblia? (Hermenéutica)': 'HER',
  'Evangelios': 'EVA', 'Hechos': 'HCH',
  'Defendiendo la Fe (Apologética)': 'DLF',
  'Cómo Tomar Buenas Desiciones (Viviendo en Integri)': 'CTBD',
  'Pre Matrimonial': 'PREMAT', 'Hebreos': 'HEB', 'Romanos': 'ROM',
  'Amor sin Fronteras': 'ASF',
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], f = '', q = false
  for (let i = 0; i < text.length; i++) { const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++ } else q = false } else f += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(f); f = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.some(x => x !== '')) rows.push(row); row = [] }
    else f += c }
  if (f !== '' || row.length) { row.push(f); if (row.some(x => x !== '')) rows.push(row) }
  return rows
}

async function fetchAll<T>(table: string, select: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) { const { data, error } = await supabase.from(table).select(select).range(from, from + 999); if (error) throw error; out.push(...(data as T[])); if (!data || data.length < 1000) break }
  return out
}

async function main() {
  const raw = readFileSync(new URL('../data-import/historico-estudios.csv', import.meta.url), 'utf8').replace(/^﻿/, '')
  const rows = parseCSV(raw)
  const H = rows[0].map(h => h.trim())
  const qi = H.indexOf('Queue Name'), di = H.indexOf('Due'), ii = H.indexOf('Ind ID')

  const members = await fetchAll<{ id: string; external_id: string | null }>('members', 'id, external_id')
  const extMap = new Map<string, string>()
  for (const m of members) if (m.external_id) extMap.set(String(m.external_id), m.id)

  const plans = await fetchAll<{ id: string; code: string }>('study_plans', 'id, code')
  const planByCode = new Map(plans.map(p => [p.code, p.id]))

  // Resolver enrollments dedup por (member, plan) — quedarse con la fecha más reciente.
  const byKey = new Map<string, { member_id: string; code: string; date: string | null }>()
  const unmapped = new Map<string, number>()
  let noMember = 0
  for (let r = 1; r < rows.length; r++) {
    const c = rows[r]
    const queue = (c[qi] ?? '').trim()
    const code = QUEUE_MAP[queue]
    if (!code) { unmapped.set(queue, (unmapped.get(queue) ?? 0) + 1); continue }
    const mid = extMap.get(String((c[ii] ?? '').trim()))
    if (!mid) { noMember++; continue }
    const dRaw = (c[di] ?? '').trim().slice(0, 10)
    const date = /^(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(dRaw) ? dRaw : null
    const key = `${mid}|${code}`
    const prev = byKey.get(key)
    if (!prev || (date && (!prev.date || date > prev.date))) byKey.set(key, { member_id: mid, code, date })
  }

  const enrollments = [...byKey.values()]
  console.log(`Filas: ${rows.length - 1}`)
  console.log(`Enrollments resueltos (dedup por miembro+plan): ${enrollments.length}`)
  console.log(`Sin miembro (Ind ID no está en members): ${noMember}`)
  console.log(`\nQueue Names NO mapeados (no están en el catálogo):`)
  ;[...unmapped.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${n}\t${k}`))

  if (!APPLY) { console.log('\n(dry-run) Corré con --apply para escribir.'); return }

  // Grupo "Histórico" por plan (uno por código usado)
  const usedCodes = [...new Set(enrollments.map(e => e.code))]
  const histGroupByCode = new Map<string, string>()
  for (const code of usedCodes) {
    const planId = planByCode.get(code); if (!planId) continue
    // reusar si ya existe
    const { data: ex } = await supabase.from('study_groups').select('id').eq('plan_id', planId).eq('name', `${code} — Histórico`).maybeSingle()
    if (ex) { histGroupByCode.set(code, (ex as { id: string }).id); continue }
    const { data, error } = await supabase.from('study_groups').insert({ plan_id: planId, name: `${code} — Histórico`, status: 'finished', current_week: 0 }).select('id').single()
    if (error) { console.error('grupo histórico', code, error.message); continue }
    histGroupByCode.set(code, (data as { id: string }).id)
  }
  console.log(`Grupos históricos: ${histGroupByCode.size}`)

  const recs = enrollments.map(e => ({
    group_id: histGroupByCode.get(e.code), member_id: e.member_id,
    status: 'completed', enrolled_at: e.date, completed_at: e.date,
  })).filter(r => r.group_id)

  let ok = 0
  for (let i = 0; i < recs.length; i += 500) {
    const chunk = recs.slice(i, i + 500)
    const { error } = await supabase.from('study_enrollments').upsert(chunk, { onConflict: 'group_id,member_id', ignoreDuplicates: true })
    if (error) { console.error('\nlote', i, error.message); process.exit(1) }
    ok += chunk.length; process.stdout.write(`\rInsertados: ${ok}/${recs.length}`)
  }
  console.log(`\nEnrollments creados: ${ok}`)
}

main()
