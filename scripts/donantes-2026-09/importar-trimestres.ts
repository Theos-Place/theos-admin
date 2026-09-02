/**
 * Importa las donaciones que falten desde un export de grupos de CCB.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/donantes-2026-09/importar-trimestres.ts <archivo.csv>
 *   aplicar:  ... <archivo.csv> --aplicar
 *
 * POR QUÉ NO SE USA scripts/seed-donations.ts. Ese script dedupica mirando solo
 * `source_file LIKE 'group_participants_import%'`, y en producción hay 539
 * filas SIN ese prefijo (las cargadas desde la pantalla de importación, que
 * guarda el nombre del archivo pelado). De las de Abr-Jun 2026, 502 personas
 * están ÚNICAMENTE sin prefijo: correr aquel script les crearía una segunda
 * fila del mismo trimestre.
 *
 * Acá el dedup es por (member_id, donation_date) contra la tabla completa, sin
 * mirar el source_file. En este modelo una persona tiene una fila por
 * trimestre: si ya la tiene, no se agrega otra, venga de donde venga.
 *
 * Tampoco se toca scripts/data/group_participants.csv, que es el histórico
 * completo (17.229 filas, 2.035 grupos incluyendo los de estudio). El archivo
 * entra por argumento.
 *
 * Los montos quedan en 0, como todas las 14.710 filas que ya están: el export
 * de CCB dice QUIÉN donó en cada trimestre, no cuánto. Los montos siguen
 * pendientes de QuickBooks.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import { Client } from 'pg'
import { cargarEnv } from '../verificacion-cierres-2026-08/lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')
const ARCHIVO = process.argv.find(a => a.endsWith('.csv'))
if (!ARCHIVO) { console.error('Falta el CSV: ... importar-trimestres.ts <archivo.csv>'); process.exit(1) }

/** Nombre del grupo → primer día del trimestre. Mismas reglas que
 *  seed-donations.ts; el orden importa (los rangos antes que los sueltos). */
const REGLAS: Array<[RegExp, string]> = [
  [/Ene\s*-\s*Mar\s+(\d{4})/, '01-01'],
  [/Abr\s*-\s*Jun\s+(\d{4})/, '04-01'],
  [/Jul\s*-\s*Set\s+(\d{4})/, '07-01'],
  [/Oct\s*-\s*Dic\s+(\d{4})/, '10-01'],
  [/Ene\s*-\s*Dic\s+(\d{4})/, '01-01'],
  [/UPPT\s+(\d{4})/, '01-01'],
  [/Dic\s+(\d{4})/, '10-01'],
  [/Jul\s+(\d{4})/, '07-01'],
]

function fechaDelGrupo(nombre: string): string | null {
  for (const [re, md] of REGLAS) {
    const m = nombre.match(re)
    if (m) return `${m[1]}-${md}`
  }
  return null
}

async function main() {
  console.log(APLICAR ? '⚠️  APLICANDO\n' : '🔍 DRY-RUN — no escribe nada\n')

  const registros: Record<string, string>[] = parse(readFileSync(ARCHIVO!, 'utf8'), {
    columns: true, bom: true, skip_empty_lines: true, trim: true,
  })
  console.log(`CSV: ${registros.length.toLocaleString()} filas`)

  // Si un grupo no mapea a trimestre se para acá: importar con la fecha
  // equivocada es peor que no importar.
  const sinRegla = new Set<string>()
  for (const r of registros) if (!fechaDelGrupo(r['Group Name'] ?? '')) sinRegla.add(r['Group Name'] ?? '(vacío)')
  if (sinRegla.size) {
    console.error('\n✗ Grupos sin regla de fecha:')
    for (const g of sinRegla) console.error('  ·', g)
    process.exit(1)
  }

  const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').match(/https:\/\/([a-z0-9]+)\./)![1]
  const c = new Client({
    connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD!)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

  // external_id → member_id. Por SQL directo: PostgREST corta en 1000 filas y
  // hay más de 18.000 fichas con external_id.
  const { rows: miembros } = await c.query<{ id: string; external_id: string }>(
    `select id, external_id from members where external_id is not null`)
  const porExterno = new Map(miembros.map(m => [m.external_id, m.id]))
  console.log(`Fichas con external_id: ${porExterno.size.toLocaleString()}`)

  // Dedup por (member_id, fecha) sobre TODA la tabla — el punto del script.
  const { rows: yaEstan } = await c.query<{ member_id: string; f: string }>(
    `select member_id, donation_date::date::text f from donations where member_id is not null`)
  const existentes = new Set(yaEstan.map(d => `${d.member_id}|${d.f}`))
  console.log(`Donaciones ya registradas: ${existentes.size.toLocaleString()}`)

  type Fila = { member_id: string; donation_date: string; source_file: string }
  const aInsertar: Fila[] = []
  const sinFicha: Array<{ ind: string; nombre: string; grupo: string }> = []
  const porTrimestre = new Map<string, { nuevas: number; yaEstaban: number; sinFicha: number }>()
  let yaEstaban = 0

  for (const r of registros) {
    const ind = (r['Ind ID'] ?? '').trim()
    const grupo = (r['Group Name'] ?? '').trim()
    const fecha = fechaDelGrupo(grupo)!
    const acc = porTrimestre.get(grupo) ?? { nuevas: 0, yaEstaban: 0, sinFicha: 0 }
    porTrimestre.set(grupo, acc)

    const memberId = porExterno.get(ind)
    if (!memberId) { sinFicha.push({ ind, nombre: r['Name'] ?? '', grupo }); acc.sinFicha++; continue }
    const clave = `${memberId}|${fecha}`
    if (existentes.has(clave)) { yaEstaban++; acc.yaEstaban++; continue }
    existentes.add(clave) // también dedupica dentro de esta corrida
    aInsertar.push({ member_id: memberId, donation_date: fecha, source_file: `group_participants_import | ${grupo}` })
    acc.nuevas++
  }

  console.log('\n── por trimestre ──')
  for (const [grupo, a] of [...porTrimestre].sort()) {
    console.log(`  ${grupo}`)
    console.log(`      nuevas ${String(a.nuevas).padStart(4)} · ya estaban ${String(a.yaEstaban).padStart(4)} · sin ficha ${String(a.sinFicha).padStart(3)}`)
  }
  console.log(`\nTotal: ${aInsertar.length} nuevas · ${yaEstaban} ya estaban · ${sinFicha.length} sin ficha`)

  if (sinFicha.length) {
    mkdirSync('scripts/output', { recursive: true })
    const csv = ['ind_id,nombre,grupo', ...sinFicha.map(n => `${n.ind},"${n.nombre.replace(/"/g, '""')}","${n.grupo}"`)].join('\n')
    writeFileSync('scripts/output/donaciones-sin-ficha.csv', csv)
    console.log(`\nSin ficha → scripts/output/donaciones-sin-ficha.csv (revisión manual)`)
    for (const n of sinFicha.slice(0, 10)) console.log(`  · ${n.ind} — ${n.nombre} (${n.grupo})`)
    if (sinFicha.length > 10) console.log(`  … y ${sinFicha.length - 10} más`)
  }

  if (!APLICAR) { console.log('\n(dry-run) Correlo con --aplicar.'); await c.end(); return }
  if (aInsertar.length === 0) { console.log('\nNada que insertar.'); await c.end(); return }

  const importadoEn = new Date().toISOString()
  await c.query('begin')
  try {
    // En tandas: 433+ inserts en una sola sentencia arma una query enorme.
    let n = 0
    for (let i = 0; i < aInsertar.length; i += 200) {
      const tanda = aInsertar.slice(i, i + 200)
      const valores = tanda.map((_, j) =>
        `($${j * 4 + 1}, $${j * 4 + 2}::date, 0, $${j * 4 + 3}, true, $${j * 4 + 4}::timestamptz)`).join(', ')
      const params = tanda.flatMap(f => [f.member_id, f.donation_date, f.source_file, importadoEn])
      const r = await c.query(
        `insert into donations (member_id, donation_date, amount, source_file, is_identified, imported_at)
         values ${valores}`, params)
      n += r.rowCount ?? 0
    }
    await c.query('commit')
    console.log(`\n  ✅ insertadas ${n} donaciones`)
  } catch (e) {
    await c.query('rollback')
    console.error('❌ rollback:', e instanceof Error ? e.message : e)
    process.exit(1)
  }
  await c.end()
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
