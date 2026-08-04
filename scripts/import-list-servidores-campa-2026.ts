/**
 * One-off: crea la lista guardada "Servidores comprometidos Campa 2026" en
 * /miembros/listas a partir de data-import/servidores-comprometidos-campa-2026.csv
 * (export del manual de servidores; trae el ID del sistema anterior, CCB).
 *
 * Uso (OJO con NODE_OPTIONS: member-lists.ts hace `import 'server-only'`, que
 * revienta en tsx sin la condición react-server):
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/import-list-servidores-campa-2026.ts
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/import-list-servidores-campa-2026.ts --commit
 *
 * Sin --commit solo imprime el reporte y NO escribe nada.
 *
 * La lista se crea con createMemberList(), el mismo camino que usa la pantalla de
 * listas guardadas, para que queden bien todos los campos y se pueda elegir como
 * audiencia en /comunicaciones igual que cualquier otra. Es ESTÁTICA: los ids van
 * en member_ids y no se recalcula sola (no hay filtro que describa "estas 420
 * personas del manual").
 *
 * NO toca ningún dato de miembros: solo lee members y crea una fila en member_lists.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

for (const file of ['.env', '.env.local']) {
  try {
    const t = readFileSync(join(process.cwd(), file), 'utf8')
    for (const line of t.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* sigue */ }
}

const CSV = 'data-import/servidores-comprometidos-campa-2026.csv'
const LIST_NAME = 'Servidores comprometidos Campa 2026'

/** Igual que el resto de los importadores del repo (group-import-rules, vacancy-import). */
const norm = (s: string) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')

/**
 * Para comparar nombres: además del norm, saca los apodos. El manual los trae de
 * dos formas — Carlos "Caco" Chavarria Borbon y Arnoldo (Nono) Moreno Chartier —
 * y el padrón guarda el nombre legal, así que el apodo solo estorba.
 */
const normName = (s: string) => norm((s ?? '').replace(/"[^"]*"/g, ' ').replace(/\([^)]*\)/g, ' '))

/** CSV con comillas dobles al estilo Excel (""..."" dentro de un campo citado). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ } else quoted = false
      } else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (c !== '\r') cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows.filter(r => r.some(v => v.trim() !== ''))
}

type Member = {
  id: string
  external_id: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  email_bounced: boolean | null
  is_active: boolean | null
  is_system: boolean | null
}

const fullName = (m: Member) => `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim()

async function main() {
  const commit = process.argv.includes('--commit')
  const { createAdminClient } = await import('../src/lib/supabase/admin')
  const { createMemberList, getMemberLists } = await import('../src/lib/supabase/queries/member-lists')
  const db = createAdminClient()

  // ── CSV ──────────────────────────────────────────────────────────────────
  const rows = parseCsv(readFileSync(CSV, 'utf8'))
  const header = rows[0].map(h => h.trim())
  const iId = header.indexOf('external_id')
  const iName = header.indexOf('nombre_completo')
  if (iId < 0 || iName < 0) throw new Error(`El CSV no trae external_id/nombre_completo: ${header.join(',')}`)

  type CsvRow = { linea: number; id: string; nombre: string }
  const csvRows: CsvRow[] = rows.slice(1).map((r, idx) => ({
    linea: idx + 2,
    id: (r[iId] ?? '').trim(),
    nombre: (r[iName] ?? '').trim(),
  }))

  // Filas repetidas en el propio CSV: el manual se llena a mano.
  const porId = new Map<string, CsvRow[]>()
  for (const r of csvRows) if (r.id) porId.set(r.id, [...(porId.get(r.id) ?? []), r])
  const csvDuplicados = [...porId.values()].filter(v => v.length > 1)

  // ── Padrón completo (paginado: PostgREST corta en 1000) ──────────────────
  const members: Member[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('members')
      .select('id, external_id, first_name, last_name, email, email_bounced, is_active, is_system')
      .order('id')
      .range(from, from + 999)
    if (error) throw error
    const page = (data ?? []) as Member[]
    members.push(...page)
    if (page.length < 1000) break
  }

  const byExternal = new Map<string, Member[]>()
  const byName = new Map<string, Member[]>()
  for (const m of members) {
    const ext = (m.external_id ?? '').trim()
    if (ext) byExternal.set(ext, [...(byExternal.get(ext) ?? []), m])
    const n = normName(fullName(m))
    if (n) byName.set(n, [...(byName.get(n) ?? []), m])
  }

  // ── Matcheo ─────────────────────────────────────────────────────────────
  type Hit = { row: CsvRow; member: Member; via: 'external_id' | 'nombre' }
  const porExternalId: Hit[] = []
  const porNombre: Hit[] = []
  const ambiguos: Array<{ row: CsvRow; candidatos: Member[]; via: string }> = []
  const descartados: Array<{ row: CsvRow; member: Member; motivo: string; via: string }> = []
  const sinMatch: CsvRow[] = []

  const usable = (m: Member) => m.is_active !== false && m.is_system !== true
  const motivo = (m: Member) =>
    m.is_system === true ? 'ficha del sistema' : m.is_active === false ? 'inactivo' : ''

  for (const row of csvRows) {
    // 1) external_id — match exacto, ambos lados como texto sin espacios.
    const porExt = row.id ? byExternal.get(row.id) ?? [] : []
    if (porExt.length === 1) {
      const m = porExt[0]
      if (usable(m)) porExternalId.push({ row, member: m, via: 'external_id' })
      else descartados.push({ row, member: m, motivo: motivo(m), via: 'external_id' })
      continue
    }
    if (porExt.length > 1) {
      ambiguos.push({ row, candidatos: porExt, via: 'external_id repetido en members' })
      continue
    }

    // 2) Fallback por nombre normalizado. Va marcado aparte: un homónimo es un
    //    riesgo real, no se da por bueno solo.
    const cand = (byName.get(normName(row.nombre)) ?? [])
    const vivos = cand.filter(usable)
    if (vivos.length === 1) { porNombre.push({ row, member: vivos[0], via: 'nombre' }); continue }
    if (vivos.length > 1) { ambiguos.push({ row, candidatos: vivos, via: 'mismo nombre en varios miembros' }); continue }
    if (cand.length >= 1) {
      for (const m of cand) descartados.push({ row, member: m, motivo: motivo(m), via: 'nombre' })
      continue
    }
    sinMatch.push(row)
  }

  // Una misma persona puede salir en dos filas del CSV: la lista va sin repetidos.
  const hits = [...porExternalId, ...porNombre]
  const idsUnicos: string[] = []
  const vistos = new Set<string>()
  for (const h of hits) if (!vistos.has(h.member.id)) { vistos.add(h.member.id); idsUnicos.push(h.member.id) }

  const seleccionados = idsUnicos.map(id => members.find(m => m.id === id)!)
  const sinCorreo = seleccionados.filter(m => !(m.email ?? '').trim())
  const rebotados = seleccionados.filter(m => m.email_bounced === true && (m.email ?? '').trim())

  // ── Reporte ─────────────────────────────────────────────────────────────
  const L = (s = '') => console.log(s)
  L(`CSV: ${CSV} — ${csvRows.length} filas`)
  L(`Padrón leído: ${members.length} miembros`)
  L()
  L('── RESUMEN ─────────────────────────────────────────')
  L(`  Match por external_id (ID de CCB) : ${porExternalId.length}`)
  L(`  Match por nombre (REVISAR)        : ${porNombre.length}`)
  L(`  Ambiguos (NO se incluyen)         : ${ambiguos.length}`)
  L(`  Descartados por estado del padrón : ${descartados.length}`)
  L(`  Sin match                         : ${sinMatch.length}`)
  L(`  ─────────────────────────────────────────────────`)
  L(`  Miembros únicos en la lista       : ${idsUnicos.length}`)
  if (hits.length !== idsUnicos.length) L(`  (${hits.length - idsUnicos.length} filas del CSV apuntaban a un miembro ya incluido)`)
  L()
  L('── ENVÍO: a cuántos NO les va a llegar ──────────────')
  L(`  Sin correo en el padrón : ${sinCorreo.length}`)
  L(`  Con correo rebotado     : ${rebotados.length}   (el sistema los salta)`)
  L(`  Reciben el correo       : ${idsUnicos.length - sinCorreo.length - rebotados.length}`)
  if (sinCorreo.length) {
    L('  Sin correo:')
    for (const m of sinCorreo) L(`    · ${fullName(m)} (CCB ${m.external_id ?? '—'})`)
  }
  if (rebotados.length) {
    L('  Rebotados:')
    for (const m of rebotados) L(`    · ${fullName(m)} <${m.email}>`)
  }

  // Control de sanidad del match por ID: el ID es ciego, así que si la migración
  // hubiera corrido los external_id, la lista quedaría mal sin que nada avise.
  // Comparar el nombre del manual contra el del padrón lo delata.
  const nombreDistinto = porExternalId.filter(h => normName(h.row.nombre) !== normName(fullName(h.member)))
  L()
  L('── CONTROL: el ID de CCB apunta a la persona correcta ─')
  L(`  Nombre idéntico al del manual : ${porExternalId.length - nombreDistinto.length} de ${porExternalId.length}`)
  L(`  Nombre distinto (revisar)     : ${nombreDistinto.length}`)
  for (const h of nombreDistinto) {
    L(`    · CCB ${h.row.id}: manual "${h.row.nombre}" → padrón "${fullName(h.member)}"`)
  }

  if (porNombre.length) {
    L()
    L('── MATCHEADOS POR NOMBRE — revisar uno por uno ──────')
    L('   (el ID de CCB del manual no existe en el padrón; se pegó por nombre)')
    for (const h of porNombre) {
      L(`  · CSV "${h.row.nombre}" (CCB ${h.row.id || '—'}, línea ${h.row.linea})`)
      L(`      → ${fullName(h.member)}  CCB ${h.member.external_id ?? '—'}  <${h.member.email ?? 'sin correo'}>`)
    }
  }

  if (ambiguos.length) {
    L()
    L('── AMBIGUOS — NO se incluyen ───────────────────────')
    for (const a of ambiguos) {
      L(`  · CSV "${a.row.nombre}" (CCB ${a.row.id || '—'}, línea ${a.row.linea}) — ${a.via}`)
      for (const m of a.candidatos) L(`      candidato: ${fullName(m)}  CCB ${m.external_id ?? '—'}  <${m.email ?? 'sin correo'}>`)
    }
  }

  if (descartados.length) {
    L()
    L('── DESCARTADOS por estado del padrón ───────────────')
    for (const d of descartados) L(`  · "${d.row.nombre}" (CCB ${d.row.id || '—'}) → ${fullName(d.member)}: ${d.motivo} [match por ${d.via}]`)
  }

  if (sinMatch.length) {
    L()
    L('── SIN MATCH — no están en el padrón ───────────────')
    for (const r of sinMatch) L(`  · "${r.nombre}" (CCB ${r.id || '—'}, línea ${r.linea})`)
  }

  if (csvDuplicados.length) {
    L()
    L('── FILAS REPETIDAS EN EL CSV ───────────────────────')
    for (const g of csvDuplicados) L(`  · CCB ${g[0].id}: líneas ${g.map(r => r.linea).join(', ')} — ${g.map(r => r.nombre).join(' / ')}`)
  }

  // ── Crear la lista ──────────────────────────────────────────────────────
  L()
  const yaExiste = (await getMemberLists()).find(l => l.name === LIST_NAME)
  if (yaExiste) {
    L(`⚠ Ya existe una lista "${LIST_NAME}" (${yaExiste.id}, ${yaExiste.member_count} miembros).`)
    L('  Este script no la sobrescribe: borrala en /miembros/listas y volvé a correrlo,')
    L('  o editala desde la pantalla.')
    return
  }
  if (!commit) {
    L('DRY-RUN: no se creó nada. Volvé a correrlo con --commit para crear la lista.')
    return
  }

  const list = await createMemberList({
    name: LIST_NAME,
    description:
      'Importada del manual de servidores para la Campa 2026, matcheada por ID de CCB. ' +
      `${porExternalId.length} por ID y ${porNombre.length} por nombre, de ${csvRows.length} filas del manual. ` +
      'Lista estática: no se actualiza sola.',
    // Estática: no hay filtro del padrón que reproduzca "los del manual".
    filters: { conditions: [], groups: [] },
    segment_label: 'Servidores · Campa 2026',
    member_ids: idsUnicos,
    member_count: idsUnicos.length,
    is_dynamic: false,
    tags: ['servidores', 'campa-2026'],
  })
  L(`✓ Lista creada: "${list.name}" (${list.id}) con ${list.member_count} miembros.`)
  L('  Verificala en /miembros/listas y elegila como audiencia en /comunicaciones.')
}

main().catch(e => { console.error(e); process.exit(1) })
