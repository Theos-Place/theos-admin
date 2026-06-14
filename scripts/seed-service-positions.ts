/**
 * Importa puestos de servicio desde scripts/data/service-positions.xlsx (o .csv).
 * Columnas (case/acentos-insensible): comité, ubicación, puesto, cantidad,
 * descripción, categoría (requisito de estudio), funciones, perfil, expiración,
 * destacado.
 *
 * - Match del comité por nombre (case-insensitive) contra areas (area_type='committee').
 * - Dedup por (area_id + título + ubicación) normalizados.
 * - Sin match de comité → scripts/output/positions-no-match.csv para revisión.
 *
 * Dry-run por defecto (no escribe nada). Aplicar:
 *   npx tsx scripts/seed-service-positions.ts --apply
 *   npx tsx scripts/seed-service-positions.ts --file=otro.xlsx --apply
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const fileArg = process.argv.find(a => a.startsWith('--file='))?.slice('--file='.length)

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

const norm = (s: string) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const TRUEY = new Set(['si', 'true', 'x', '1', 'yes', 'verdadero'])

function parseDate(v: string): string | null {
  const s = (v ?? '').trim()
  if (!s) return null
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (m) { const [, d, mo, y] = m; const year = y.length === 2 ? `20${y}` : y; return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}` }
  const dt = new Date(s)
  return isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10)
}

type Row = {
  committee: string; location: string; title: string; quantity: number
  description: string; study_requirement: string; functions: string
  profile: string; expires_at: string | null; is_featured: boolean
}

function loadRows(path: URL): Row[] {
  const wb = /\.csv$/i.test(path.pathname)
    ? XLSX.read(readFileSync(path, 'utf8'), { type: 'string' })
    : XLSX.read(readFileSync(path), { type: 'buffer' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const aoa = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' })
  if (aoa.length === 0) return []
  const header = aoa[0].map(norm)
  const idx = (...names: string[]) => header.findIndex(h => names.some(n => h.includes(n)))
  const ci = idx('comite'), li = idx('ubicaci'), ti = idx('puesto', 'titulo', 'nombre'),
    qi = idx('cantidad'), di = idx('descrip'), ri = idx('categor', 'requisit'),
    fi = idx('funcion'), pi = idx('perfil'), ei = idx('expira', 'vence'), fe = idx('destacad')
  const at = (cols: string[], i: number) => (i >= 0 ? String(cols[i] ?? '').trim() : '')
  return aoa.slice(1)
    .filter(cols => cols.some(c => String(c ?? '').trim() !== ''))
    .map(cols => ({
      committee: at(cols, ci), location: at(cols, li), title: at(cols, ti),
      quantity: Math.max(1, Number(at(cols, qi).replace(/[^\d]/g, '')) || 1),
      description: at(cols, di), study_requirement: at(cols, ri), functions: at(cols, fi),
      profile: at(cols, pi), expires_at: parseDate(at(cols, ei)), is_featured: TRUEY.has(norm(at(cols, fe))),
    }))
    .filter(r => r.title && r.committee)
}

async function main() {
  const fileName = fileArg ?? 'service-positions.xlsx'
  const path = new URL(`./data/${fileName}`, import.meta.url)
  if (!existsSync(path)) { console.error(`No se encontró scripts/data/${fileName}`); process.exit(1) }
  const rows = loadRows(path)
  console.log(`Leídas ${rows.length} filas de ${fileName}`)

  const { data: committees } = await supabase.from('areas').select('id, name').eq('area_type', 'committee')
  const byName = new Map<string, string>()
  for (const c of (committees ?? []) as Array<{ id: string; name: string }>) byName.set(norm(c.name), c.id)

  const { data: existing } = await supabase.from('service_positions').select('title, area_id, location')
  const seen = new Set<string>()
  const key = (areaId: string, title: string, loc: string) => `${areaId}|${norm(title)}|${norm(loc)}`
  for (const p of (existing ?? []) as Array<{ title: string; area_id: string; location: string | null }>) seen.add(key(p.area_id, p.title, p.location ?? ''))

  const toInsert: Record<string, unknown>[] = []
  const noMatch: Row[] = []
  let duplicates = 0
  for (const r of rows) {
    const areaId = byName.get(norm(r.committee))
    if (!areaId) { noMatch.push(r); continue }
    const k = key(areaId, r.title, r.location)
    if (seen.has(k)) { duplicates++; continue }
    seen.add(k)
    toInsert.push({
      area_id: areaId, title: r.title, location: r.location || null, quantity: r.quantity,
      max_volunteers: r.quantity, description: r.description || null, study_requirement: r.study_requirement || null,
      functions: r.functions || null, profile: r.profile || null, expires_at: r.expires_at, is_featured: r.is_featured, is_active: true,
    })
  }

  console.log(`A insertar: ${toInsert.length} · duplicados: ${duplicates} · sin comité: ${noMatch.length}`)

  if (noMatch.length) {
    mkdirSync(new URL('./output/', import.meta.url), { recursive: true })
    const csv = ['comite,puesto', ...noMatch.map(n => `"${n.committee}","${n.title}"`)].join('\n')
    writeFileSync(new URL('./output/positions-no-match.csv', import.meta.url), csv)
    console.log('Filas sin comité escritas a scripts/output/positions-no-match.csv')
  }

  if (!APPLY) { console.log('DRY-RUN: no se insertó nada. Corré con --apply'); return }

  for (let i = 0; i < toInsert.length; i += 100) {
    const { error } = await supabase.from('service_positions').insert(toInsert.slice(i, i + 100))
    if (error) { console.error('Error insertando lote:', error.message); process.exit(1) }
  }
  console.log(`Insertados ${toInsert.length} puestos.`)
}

main().catch(e => { console.error(e); process.exit(1) })
