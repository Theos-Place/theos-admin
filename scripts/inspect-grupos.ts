import { readFileSync } from 'node:fs'
import { parse } from 'csv-parse/sync'

const raw = readFileSync(new URL('../data-import/grupos.csv', import.meta.url), 'utf8')
const recs: Record<string, string>[] = parse(raw, { columns: true, bom: true, relax_quotes: true, relax_column_count: true, skip_empty_lines: true })

const groups = new Map<string, { rows: Record<string, string>[] }>()
for (const r of recs) { const g = (r['Group Name'] ?? '').trim(); if (!g) continue; const e = groups.get(g) ?? { rows: [] }; e.rows.push(r); groups.set(g, e) }

console.log('Filas:', recs.length)
console.log('Grupos distintos:', groups.size)

// status distribución
const st = new Map<string, number>()
for (const r of recs) { const s = (r['Most Recent Status'] ?? '').trim(); st.set(s, (st.get(s) ?? 0) + 1) }
console.log('Most Recent Status:', [...st.entries()])

// años detectados en nombres
let withYear = 0
for (const g of groups.keys()) if (/\b(19|20)\d{2}\b/.test(g)) withYear++
console.log('Grupos con año en el nombre:', withYear, '/', groups.size)

// líderes: grupos con al menos un Leader real (Ind ID != 12965)
let withRealLeader = 0, onlyOrgLeader = 0, noLeader = 0
for (const [, e] of groups) {
  const leaders = e.rows.filter(r => (r['Most Recent Status'] ?? '').trim() === 'Leader')
  const real = leaders.filter(r => (r['Ind ID'] ?? '').trim() !== '12965')
  if (real.length) withRealLeader++
  else if (leaders.length) onlyOrgLeader++
  else noLeader++
}
console.log(`Grupos con dirigente real: ${withRealLeader} · solo cuenta org: ${onlyOrgLeader} · sin leader: ${noLeader}`)

// tamaño de grupos
const sizes = [...groups.values()].map(e => e.rows.filter(r => (r['Ind ID'] ?? '').trim() !== '12965').length)
sizes.sort((a, b) => a - b)
console.log('Tamaño grupo (sin cuenta org): min', sizes[0], 'mediana', sizes[Math.floor(sizes.length / 2)], 'max', sizes[sizes.length - 1])

// muestra de 30 nombres de grupo para ver prefijos de estudio
console.log('\nMuestra de nombres de grupo:')
;[...groups.keys()].slice(0, 30).forEach(g => console.log('  ', g))
