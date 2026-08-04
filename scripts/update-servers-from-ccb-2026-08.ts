/**
 * One-off: actualiza datos personales de servidores desde el export de CCB
 * data-import/servidores-actualizacion-2026-08.csv (704 filas).
 *
 * Uso (OJO con NODE_OPTIONS: los módulos de queries hacen `import 'server-only'`):
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/update-servers-from-ccb-2026-08.ts
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/update-servers-from-ccb-2026-08.ts --commit
 *
 * Sin --commit NO escribe nada: imprime el reporte y genera el CSV de mapeo de
 * puestos (que es un archivo de trabajo, no una escritura en la BD).
 *
 * QUÉ ESCRIBE (solo members): email, phone, cedula, workplace, occupation.
 * cedula_normalized la calcula la base sola (columna generada).
 *
 * QUÉ NO ESCRIBE, a propósito:
 *   · Nombres — se comparan y se reportan; que los cambie una persona.
 *   · Puestos de servicio — el texto libre de CCB ensuciaría el catálogo canónico
 *     del Manual de Puestos Madre 2026. Sale un CSV para revisar a mano.
 *   · Nota de Panorama — la escribe scripts/import-panorama-grades-2026-08.ts en
 *     study_enrollments.grade del plan PAN (ya corrido).
 *
 * Las reglas de normalización (teléfono, cédula, "0" como vacío, nota, match difuso)
 * viven en src/lib/import/ccb-personal-data.ts, con tests.
 */
import { readFileSync, writeFileSync } from 'node:fs'
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

const CSV_IN = 'data-import/servidores-actualizacion-2026-08.csv'
const CSV_OUT = 'data-import/mapeo-puestos-servidores-2026-08.csv'

/** CSV con comillas al estilo Excel. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else quoted = false }
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (c !== '\r') cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows.filter(r => r.some(v => v.trim() !== ''))
}

const csvCell = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`

type Member = {
  id: string
  external_id: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  cedula: string | null
  cedula_normalized: string | null
  occupation: string | null
  workplace: string | null
  document_type: string | null
  is_active: boolean | null
  is_system: boolean | null
}

async function main() {
  const commit = process.argv.includes('--commit')
  const {
    norm, normalizePhone, normalizeDoc, cleanText, cleanOccupation,
    parseNotaPanorama, bestMatch, splitServices, detectSede,
  } = await import('../src/lib/import/ccb-personal-data')
  type CatalogEntry = import('../src/lib/import/ccb-personal-data').CatalogEntry
  const { createAdminClient } = await import('../src/lib/supabase/admin')
  const db = createAdminClient()

  // ── CSV ───────────────────────────────────────────────────────────────────
  const rows = parseCsv(readFileSync(CSV_IN, 'utf8'))
  const H = rows[0].map(h => h.replace(/^﻿/, '').trim())
  const at = (name: string) => {
    const i = H.indexOf(name)
    if (i < 0) throw new Error(`El CSV no trae la columna "${name}". Tiene: ${H.join(' | ')}`)
    return i
  }
  const iId = at('Individual ID'), iFirst = at('First Name'), iLast = at('Last Name')
  const iEmail = at('Email'), iPhone = at('Preferred Phone')
  const iServ = at('Custom Fields - Servicios actuales en Theos')
  const iDed = at('Custom Fields - Dedicacion')
  const iEmp = at('Custom Fields - Empresa en la que trabaja')
  const iCed = at('Custom Fields - ID')
  const iNota = at('Custom Fields - Nota Panorama')

  type Row = {
    linea: number; ccbId: string; first: string; last: string; email: string
    phone: string; serv: string; ded: string; emp: string; ced: string; nota: string
  }
  const csvRows: Row[] = rows.slice(1).map((r, i) => ({
    linea: i + 2,
    ccbId: (r[iId] ?? '').trim(),
    first: (r[iFirst] ?? '').trim(),
    last: (r[iLast] ?? '').trim(),
    email: (r[iEmail] ?? '').trim(),
    phone: (r[iPhone] ?? '').trim(),
    serv: (r[iServ] ?? '').trim(),
    ded: (r[iDed] ?? '').trim(),
    emp: (r[iEmp] ?? '').trim(),
    ced: (r[iCed] ?? '').trim(),
    nota: (r[iNota] ?? '').trim(),
  }))

  // ── Padrón completo (paginado: PostgREST corta en 1000) ───────────────────
  const members: Member[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('members')
      .select('id, external_id, first_name, last_name, email, phone, cedula, cedula_normalized, occupation, workplace, document_type, is_active, is_system')
      .order('id')
      .range(from, from + 999)
    if (error) throw error
    const page = (data ?? []) as Member[]
    members.push(...page)
    if (page.length < 1000) break
  }
  const byExternal = new Map<string, Member[]>()
  const byEmail = new Map<string, Member[]>()
  const byDoc = new Map<string, Member[]>()
  for (const m of members) {
    const ext = (m.external_id ?? '').trim()
    if (ext) byExternal.set(ext, [...(byExternal.get(ext) ?? []), m])
    const em = (m.email ?? '').trim().toLowerCase()
    if (em) byEmail.set(em, [...(byEmail.get(em) ?? []), m])
    const doc = (m.cedula_normalized ?? '').trim().toUpperCase()
    if (doc) byDoc.set(doc, [...(byDoc.get(doc) ?? []), m])
  }

  // ── Matcheo y cálculo de cambios ──────────────────────────────────────────
  // OJO: cedula_normalized NO va acá. Es una columna GENERADA en la base
  // (regexp_replace(cedula, '[-\s]', '')) y Postgres rechaza el UPDATE completo
  // con "can only be updated to DEFAULT" si se la manda — se pierde también el
  // resto del patch de esa ficha. La calcula la base sola al escribir cedula.
  type Patch = Partial<Pick<Member, 'email' | 'phone' | 'cedula' | 'occupation' | 'workplace'>>
  type Plan = { row: Row; member: Member; patch: Patch }

  const planes: Plan[] = []
  const sinMatch: Row[] = []
  const ambiguos: Array<{ row: Row; candidatos: Member[] }> = []
  const descartados: Array<{ row: Row; member: Member; motivo: string }> = []

  const cambiosPorCampo: Record<string, number> = {
    email: 0, phone: 0, cedula: 0, workplace: 0, occupation: 0,
  }
  const conflictosEmail: Array<{ row: Row; member: Member; email: string; duenos: Member[] }> = []
  const conflictosCedula: Array<{ row: Row; member: Member; actual: string; nueva: string }> = []
  const conflictosCedulaDup: Array<{ row: Row; member: Member; nueva: string; duenos: Member[] }> = []
  const nombresDistintos: Array<{ row: Row; member: Member }> = []
  const telefonosRaros: Array<{ row: Row; member: Member; valor: string }> = []
  const docsNoCr: Array<{ row: Row; member: Member; valor: string; kind: string }> = []

  const nombre = (m: Member) => `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim()

  for (const row of csvRows) {
    const cands = row.ccbId ? byExternal.get(row.ccbId) ?? [] : []
    if (cands.length === 0) { sinMatch.push(row); continue }
    if (cands.length > 1) { ambiguos.push({ row, candidatos: cands }); continue }
    const m = cands[0]
    if (m.is_system) { descartados.push({ row, member: m, motivo: 'ficha del sistema' }); continue }
    if (m.is_active === false) { descartados.push({ row, member: m, motivo: 'inactivo' }); continue }

    const patch: Patch = {}

    // Email — a minúsculas, y nunca si ya es de OTRO miembro (el dedup del sistema
    // es por correo case-insensitive).
    const email = row.email.trim().toLowerCase()
    if (email) {
      const actual = (m.email ?? '').trim().toLowerCase()
      if (email !== actual) {
        const duenos = (byEmail.get(email) ?? []).filter(x => x.id !== m.id)
        if (duenos.length > 0) conflictosEmail.push({ row, member: m, email, duenos })
        else { patch.email = email; cambiosPorCampo.email++ }
      }
    }

    // Teléfono
    const tel = normalizePhone(row.phone)
    if (tel.ok) {
      if (tel.changed === 'internacional') telefonosRaros.push({ row, member: m, valor: tel.value })
      if (tel.value !== (m.phone ?? '')) { patch.phone = tel.value; cambiosPorCampo.phone++ }
    }

    // Cédula — SOLO si el miembro no tiene. Nunca se pisa una existente.
    const doc = normalizeDoc(row.ced)
    if (doc.ok) {
      const actual = (m.cedula_normalized ?? '').trim().toUpperCase()
      if (!actual) {
        const duenos = (byDoc.get(doc.value) ?? []).filter(x => x.id !== m.id)
        if (duenos.length > 0) {
          // La BD no fuerza cédula única, pero el sistema dedupe por ahí: escribir
          // una repetida crearía dos fichas "de la misma persona".
          conflictosCedulaDup.push({ row, member: m, nueva: doc.value, duenos })
        } else {
          patch.cedula = doc.value
          cambiosPorCampo.cedula++
          if (doc.kind !== 'cr_9') docsNoCr.push({ row, member: m, valor: doc.value, kind: doc.kind })
        }
      } else if (actual !== doc.value) {
        conflictosCedula.push({ row, member: m, actual: m.cedula ?? actual, nueva: doc.value })
      }
    }

    // Empresa y dedicación — un valor vacío del CSV nunca pisa un dato bueno.
    const emp = cleanText(row.emp)
    if (emp && emp !== (m.workplace ?? '')) { patch.workplace = emp; cambiosPorCampo.workplace++ }
    const ded = cleanOccupation(row.ded)
    if (ded && ded !== (m.occupation ?? '')) { patch.occupation = ded; cambiosPorCampo.occupation++ }

    // Nombres: solo se comparan.
    const csvNombre = `${row.first} ${row.last}`.trim()
    if (norm(csvNombre) !== norm(nombre(m))) nombresDistintos.push({ row, member: m })

    if (Object.keys(patch).length > 0) planes.push({ row, member: m, patch })
  }

  // ── B) CSV de mapeo de puestos ────────────────────────────────────────────
  const [{ data: posData }, { data: areaData }, { data: sedeData }] = await Promise.all([
    db.from('service_positions').select('id, title, area_id').eq('is_active', true),
    db.from('areas').select('id, name, area_type').eq('is_active', true),
    db.from('sedes').select('name'),
  ])
  const areas = (areaData ?? []) as Array<{ id: string; name: string; area_type: string }>
  const areaName = new Map(areas.map(a => [a.id, a.name]))
  const catalog: CatalogEntry[] = [
    ...((posData ?? []) as Array<{ id: string; title: string; area_id: string | null }>).map(p => ({
      id: p.id, label: p.title, kind: 'puesto' as const, area: p.area_id ? areaName.get(p.area_id) ?? null : null,
    })),
    ...areas.map(a => ({
      id: a.id, label: a.name, kind: (a.area_type === 'committee' ? 'comite' : 'area') as 'comite' | 'area', area: null,
    })),
  ]
  const sedeNames = ((sedeData ?? []) as Array<{ name: string }>).map(s => s.name)

  type MapRow = {
    ccbId: string; nombre: string; memberId: string; original: string
    sugerido: string; tipo: string; areaSug: string; score: string; sede: string
  }
  const mapeo: MapRow[] = []
  for (const row of csvRows) {
    const items = splitServices(row.serv)
    if (items.length === 0) continue
    const m = (byExternal.get(row.ccbId) ?? [])[0]
    for (const texto of items) {
      const sede = detectSede(texto, sedeNames)
      // Si el texto trae sede ("Bienvenida Escazú"), la sugerencia se busca DENTRO
      // del área de esa sede y con la sede quitada del texto. Sin esto salía
      // "Coordinador Bienvenida" de Sede Madrid para alguien de Escazú: el puesto
      // correcto pero en la sede equivocada, que es peor que no sugerir nada.
      const enSede = sede
        ? catalog.filter(e => e.area && norm(e.area).includes(norm(sede)))
        : []
      const sinSede = sede ? texto.replace(new RegExp(sede, 'i'), '').trim() : texto
      const global = bestMatch(texto, catalog)
      const enSedeBest = enSede.length > 0 && sinSede ? bestMatch(sinSede, enSede) : { entry: null, score: 0 }
      // La sugerencia de la sede solo gana si es DECENTE: acotar a la sede a veces
      // deja sin candidato razonable ("Youth Heredia" no tiene puesto de Youth en
      // Sede Heredia) y ahí una mala sugerencia local es peor que la global.
      const best = enSedeBest.entry && enSedeBest.score >= Math.max(0.6, global.score)
        ? enSedeBest
        : global
      mapeo.push({
        ccbId: row.ccbId,
        nombre: m ? nombre(m) : `${row.first} ${row.last}`.trim(),
        memberId: m?.id ?? '',
        original: texto,
        sugerido: best.entry?.label ?? '',
        tipo: best.entry?.kind ?? '',
        areaSug: best.entry?.area ?? '',
        score: best.score.toFixed(2),
        sede: sede ?? '',
      })
    }
  }
  const BOM = '﻿'
  const cabecera = [
    'ccb_id', 'nombre', 'member_id', 'servicio_original',
    'puesto_sugerido', 'tipo_sugerido', 'area_sugerida', 'score', 'sede_detectada',
    'puesto_confirmado', 'area_confirmada', 'notas',
  ]
  const cuerpo = mapeo
    .sort((a, b) => Number(a.score) - Number(b.score) || a.original.localeCompare(b.original))
    .map(r => [r.ccbId, r.nombre, r.memberId, r.original, r.sugerido, r.tipo, r.areaSug, r.score, r.sede, '', '', '']
      .map(csvCell).join(','))
  writeFileSync(CSV_OUT, BOM + [cabecera.map(csvCell).join(','), ...cuerpo].join('\n'), 'utf8')

  // ── C) Nota de Panorama: solo clasificar ──────────────────────────────────
  const PAN_PLAN = '6a4878ba-da7e-41a0-a7ed-461888f52935'
  const notas = csvRows.map(r => ({ row: r, n: parseNotaPanorama(r.nota) }))
  const notaNum = notas.filter(x => x.n.kind === 'numero')
  const notaExcede = notaNum.filter(x => x.n.kind === 'numero' && x.n.excedeColumna)
  const notaReprob = notas.filter(x => x.n.kind === 'reprobado')
  const notaSinReg = notas.filter(x => x.n.kind === 'sin_registro')
  const notaTexto = notas.filter(x => x.n.kind === 'texto')
  // ¿Cuántos de los que traen nota tienen inscripción a PAN donde guardarla?
  const conNotaIds = notas.filter(x => x.n.kind === 'numero' || x.n.kind === 'reprobado')
    .map(x => (byExternal.get(x.row.ccbId) ?? [])[0]?.id).filter(Boolean) as string[]
  const panPorMiembro = new Set<string>()
  for (let i = 0; i < conNotaIds.length; i += 200) {
    const { data } = await db.from('study_enrollments').select('member_id')
      .eq('plan_id', PAN_PLAN).in('member_id', conNotaIds.slice(i, i + 200))
    for (const e of (data ?? []) as Array<{ member_id: string }>) panPorMiembro.add(e.member_id)
  }

  // ── Reporte ───────────────────────────────────────────────────────────────
  const L = (s = '') => console.log(s)
  L(`CSV: ${CSV_IN} — ${csvRows.length} filas`)
  L(`Padrón leído: ${members.length} miembros`)
  L()
  L('── A) MATCHEO por external_id (ID de CCB) ───────────')
  L(`  Matcheados            : ${csvRows.length - sinMatch.length - ambiguos.length}`)
  L(`  Sin match             : ${sinMatch.length}`)
  L(`  ID repetido en members: ${ambiguos.length}`)
  L(`  Descartados (inactivo/sistema): ${descartados.length}`)
  L(`  Fichas con algo que cambiar   : ${planes.length}`)
  L()
  L('── CAMPOS A ACTUALIZAR ─────────────────────────────')
  for (const [k, v] of Object.entries(cambiosPorCampo)) L(`  ${k.padEnd(11)}: ${v}`)
  L()
  L('── CONFLICTOS (no se escriben) ─────────────────────')
  L(`  Correo que ya es de otro miembro : ${conflictosEmail.length}`)
  L(`  Cédula distinta a la registrada  : ${conflictosCedula.length}`)
  L(`  Cédula que ya es de otro miembro : ${conflictosCedulaDup.length}`)
  for (const c of conflictosEmail) {
    L(`    · ${nombre(c.member)} (CCB ${c.row.ccbId}): "${c.email}" ya es de ${c.duenos.map(d => `${nombre(d)}`).join(', ')}`)
  }
  for (const c of conflictosCedula) {
    L(`    · ${nombre(c.member)} (CCB ${c.row.ccbId}): tiene ${c.actual}, el CSV trae ${c.nueva}`)
  }
  for (const c of conflictosCedulaDup) {
    L(`    · ${nombre(c.member)} (CCB ${c.row.ccbId}): ${c.nueva} ya es de ${c.duenos.map(d => nombre(d)).join(', ')}`)
  }

  if (docsNoCr.length) {
    L()
    L('── DOCUMENTOS QUE NO SON CÉDULA CR ─────────────────')
    L('   Se escriben tal cual, pero quedan con document_type="cedula", que es')
    L('   incorrecto. Decime si los paso a dni_nie / pasaporte / otro.')
    for (const d of docsNoCr) L(`    · ${nombre(d.member)}: ${d.valor} (${d.kind})`)
  }

  if (telefonosRaros.length) {
    L()
    L('── TELÉFONOS NO CR (se guardan tal cual) ───────────')
    for (const t of telefonosRaros) L(`    · ${nombre(t.member)}: ${t.valor}`)
  }

  if (nombresDistintos.length) {
    L()
    L(`── NOMBRES QUE DIFIEREN (${nombresDistintos.length}) — NO se tocan, decidí vos ──`)
    for (const n of nombresDistintos) {
      L(`    · CCB ${n.row.ccbId}: padrón "${nombre(n.member)}" | CSV "${`${n.row.first} ${n.row.last}`.trim()}"`)
    }
  }

  if (sinMatch.length) {
    L()
    L(`── SIN MATCH (${sinMatch.length}) — revisión manual ──`)
    for (const r of sinMatch) L(`    · CCB ${r.ccbId} "${r.first} ${r.last}" <${r.email || 'sin correo'}> (línea ${r.linea})`)
  }
  if (ambiguos.length) {
    L()
    L('── ID DE CCB REPETIDO EN EL PADRÓN — no se tocan ───')
    for (const a of ambiguos) L(`    · CCB ${a.row.ccbId}: ${a.candidatos.map(c => nombre(c)).join(' / ')}`)
  }
  if (descartados.length) {
    L()
    L('── DESCARTADOS por estado del padrón ───────────────')
    for (const d of descartados) L(`    · ${nombre(d.member)} (CCB ${d.row.ccbId}): ${d.motivo}`)
  }

  L()
  L('── B) MAPEO DE PUESTOS (archivo de trabajo) ─────────')
  L(`  Escrito: ${CSV_OUT}`)
  L(`  ${mapeo.length} filas (miembro × servicio), de ${csvRows.filter(r => r.serv).length} celdas con dato`)
  L(`  Catálogo comparado: ${catalog.length} entradas (${(posData ?? []).length} puestos + ${areas.length} áreas/comités)`)
  const buckets = { '1.00 exacto': 0, '0.85-0.99': 0, '0.60-0.84': 0, 'bajo 0.60': 0 }
  for (const r of mapeo) {
    const s = Number(r.score)
    if (s >= 1) buckets['1.00 exacto']++
    else if (s >= 0.85) buckets['0.85-0.99']++
    else if (s >= 0.60) buckets['0.60-0.84']++
    else buckets['bajo 0.60']++
  }
  for (const [k, v] of Object.entries(buckets)) L(`    ${k.padEnd(12)}: ${v}`)
  L(`  Con sede detectada en el texto: ${mapeo.filter(r => r.sede).length}`)
  L('  NO se escribió nada en service_positions / volunteers / position_records.')

  L()
  L('── C) NOTA DE PANORAMA (no se escribe) ──────────────')
  L(`  Numéricas          : ${notaNum.length}`)
  L(`  · de esas, >99.99  : ${notaExcede.length}  ← NO caben en study_enrollments.grade (numeric(4,2))`)
  if (notaExcede.length) L(`      valores: ${notaExcede.map(x => x.row.nota).join(', ')}`)
  L(`  "reprobó"          : ${notaReprob.length}`)
  L(`  "no hay registro"  : ${notaSinReg.length}`)
  L(`  Otro texto         : ${notaTexto.length}${notaTexto.length ? ` (${notaTexto.map(x => `"${x.row.nota}"`).join(', ')})` : ''}`)
  L(`  Con inscripción a PAN donde guardarla: ${panPorMiembro.size} de ${conNotaIds.length}`)

  // ── Escritura ─────────────────────────────────────────────────────────────
  L()
  if (!commit) {
    L('DRY-RUN: no se escribió NADA en la base. Volvé a correrlo con --commit.')
    return
  }
  let ok = 0
  const fallos: Array<{ member: Member; error: string }> = []
  for (const p of planes) {
    const { error } = await db.from('members').update(p.patch).eq('id', p.member.id)
    if (error) fallos.push({ member: p.member, error: error.message })
    else ok++
  }
  L(`✓ Actualizadas ${ok} fichas de ${planes.length}.`)
  if (fallos.length) {
    L(`✗ ${fallos.length} fallaron:`)
    for (const f of fallos) L(`    · ${nombre(f.member)}: ${f.error}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
