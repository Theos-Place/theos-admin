// One-off: sincroniza el catálogo de puestos de servicio contra el
// "Manual de Puestos Madre 2026" (data-import/manual-puestos-madre-2026-*.csv).
//
//   node scripts/sync-positions-manual-2026.mjs           → DRY-RUN (solo reporte)
//   node scripts/sync-positions-manual-2026.mjs --apply   → corrida real
//
// Reglas (confirmadas con TI):
//  · Duplicados entre hojas: gana la versión CON MANUAL.
//  · Áreas/comités: match por nombre normalizado (sin tildes, case-insensitive,
//    sin basura tipo "Servidores. "); se crean los que falten; los que estén en
//    BD y no en el CSV solo se reportan.
//  · Puestos: match por (comité + nombre normalizado). Existe → se actualiza
//    nombre canónico + campos; no existe → se crea.
//  · Campos: description←descripcion · study_requirement←requisitos/nivel_estudio
//    · functions←funciones_especificas / (como_lo_logramos + funciones_generales)
//    · profile←perfil · skills←habilidades/buscamos_personas (migración
//    20260728190000) · location←lugar.
//  · Puestos en BD sin match: candidato difuso (mismo comité) → SOLO reporte
//    para confirmación manual; sin candidato → is_active=false (nunca DELETE:
//    tienen referencias). Puestos de comités que el manual no cubre: intactos.
//  · Personas en puestos desactivados: intactas; van al reporte para
//    reasignación manual (position-role-sync puede cambiar permisos).
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// ── CSV (RFC 4180: comillas, comas y saltos de línea embebidos) ─────────────
function parseCsv(text) {
  const rows = []
  let row = [], field = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some(f => f.trim() !== '')) rows.push(row)
      row = []
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); if (row.some(f => f.trim() !== '')) rows.push(row) }
  const header = rows[0].map(h => h.trim())
  return rows.slice(1).map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])))
}

// ── Normalización ────────────────────────────────────────────────────────────
const clean = (s) => (s ?? '').replace(/\s+/g, ' ').replace(/[.\s]+$/g, '').trim()
const norm = (s) => clean(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
// Para áreas: "Área de Finanzas" ≡ "FINANZAS".
const normArea = (s) => norm(s).replace(/^area( de)? /, '')
// Para comités: la BD usa prefijos "Comité (de) X" / "SubComité X"; el CSV no.
// Además: "Theos Hombres" ≡ "Hombres"; "Servidores/RH" ≡ "Servidores".
const normComite = (s) => norm(s)
  .replace(/^(sub)?comite( de)? /, '')
  .replace(/^theos /, '')
  .replace(/\/(rh|rrhh)$/, '')

// Difuso: abreviaturas comunes + solapamiento de tokens.
const ABBR = { 'coord': 'coordinador', 'coord.': 'coordinador', 'colab': 'colaborador', 'colab.': 'colaborador', 'asist': 'asistente', 'asist.': 'asistente', 'enc': 'encargado', 'enc.': 'encargado' }
const STOP = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'en'])
function tokens(s) {
  return norm(s).split(/[^a-z0-9ñ]+/).filter(Boolean)
    .map(t => ABBR[t] ?? t).filter(t => !STOP.has(t))
}
function levRatio(a, b) {
  const m = a.length, n = b.length
  if (!m || !n) return 0
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  }
  return 1 - d[m][n] / Math.max(m, n)
}
function similarity(a, b, { lev = false } = {}) {
  const ta = new Set(tokens(a)), tb = new Set(tokens(b))
  if (!ta.size || !tb.size) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  const tokenScore = inter / Math.min(ta.size, tb.size) // contención: "Coord. Comida" ⊂ "Coordinador de Comida" = 1
  if (!lev) return tokenScore
  // Levenshtein solo para COMITÉS (agarra typos: "Comunity"≈"Community"); en
  // puestos genera falsos candidatos por prefijos compartidos ("de basket"≈"de Padel").
  return Math.max(tokenScore, levRatio(norm(a), norm(b)))
}

// El ROL del puesto (primer token) debe coincidir para emparejar títulos:
// sin esto, "Asistente de Encargado de X" se empareja con "Encargado X".
const ROLES_PUESTO = new Set(['encargado', 'asistente', 'coordinador', 'colaborador', 'orador', 'auxiliar', 'productor', 'diagramador', 'anfitrion', 'teacher', 'musico'])
const roleOf = (t) => { const first = tokens(t)[0]; return ROLES_PUESTO.has(first) ? first : null }
const sameRole = (a, b) => { const ra = roleOf(a), rb = roleOf(b); return !(ra && rb && ra !== rb) }

// Junta secciones de texto no vacías (para functions de sin-manual).
const joinParts = (...parts) => parts.map(p => clean(p)).filter(Boolean).join('\n') || null
const orNull = (s) => { const c = (s ?? '').trim(); return c && norm(c) !== 'n/a' && norm(c) !== 'no hay' ? c : null }

// Overrides confirmados por TI (2026-07-28):
//  · Comité "Mantenimiento" (sin área en la hoja) → Área Operaciones.
//  · "Community" del CSV es el "Comité Comunity" de BD (typo): se renombra.
//  · NO se desactiva ningún puesto por ahora: los sin match solo se reportan
//    (la mayoría son variantes por sede que el manual colapsa; la limpieza se
//    decide con el reporte en mano).
const AREA_OVERRIDE = { 'mantenimiento': 'OPERACIONES' }
const COMITE_RENAME = { 'community': 'Community' } // norm CSV → nombre canónico

// ── 1. Cargar CSVs y armar el catálogo deseado ──────────────────────────────
const conManual = parseCsv(readFileSync('data-import/manual-puestos-madre-2026-con-manual.csv', 'utf8'))
const sinManual = parseCsv(readFileSync('data-import/manual-puestos-madre-2026-sin-manual.csv', 'utf8'))

// key = comitéNorm|puestoNorm → fila deseada. sin-manual primero, con-manual pisa.
const desired = new Map()
const overlaps = []
for (const r of sinManual) {
  const key = `${normComite(r.comite)}|${norm(r.puesto)}`
  desired.set(key, {
    fuente: 'sin-manual',
    comite: clean(r.comite), puesto: clean(r.puesto),
    area: null, // se deduce del comité
    fields: {
      description: orNull(r.descripcion),
      study_requirement: orNull(r.nivel_estudio),
      functions: joinParts(r.funciones_generales, r.como_lo_logramos),
      profile: orNull(r.perfil),
      skills: orNull(r.buscamos_personas),
      location: orNull(r.lugar),
    },
  })
}
for (const r of conManual) {
  const key = `${normComite(r.comite)}|${norm(r.puesto)}`
  if (desired.has(key)) overlaps.push(clean(r.puesto))
  desired.set(key, {
    fuente: 'con-manual',
    comite: clean(r.comite), puesto: clean(r.puesto),
    area: clean(r.area),
    fields: {
      description: orNull(r.descripcion),
      study_requirement: orNull(r.requisitos),
      functions: orNull(r.funciones_especificas),
      profile: orNull(r.perfil),
      skills: orNull(r.habilidades),
      location: null,
    },
  })
}

// ── 1b. Lista definitiva (complemento del manual, 2026-07-28) ───────────────
// data-import/lista-puestos-definitiva-2026.tsv: donde el mismo puesto exista
// en el manual, el NOMBRE de la lista es el canónico (el manual aporta la
// descripción); los puestos que solo están en la lista se crean sin descripción.
const FIX_TITLES = {
  'ColaboradorAnuncios': 'Colaborador Anuncios',
  'Asistentene Comunity': 'Asistente Comunity',
  'Colaborador Comuity': 'Colaborador Comunity',
}
function fixTitle(t) {
  return (FIX_TITLES[t] ?? t)
    .replace(/\bEB([a-záéíóúñ])/g, (_, c) => 'EB ' + c.toUpperCase()) // EBsoftware → EB Software
    .replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, '$1 $2')                 // MujeresDecoración / GoMultimedia
}
const listaRows = readFileSync('data-import/lista-puestos-definitiva-2026.tsv', 'utf8')
  .split('\n').slice(1).map(l => l.trim()).filter(Boolean)
  .map(l => { const [comite, puesto] = l.split('\t'); return { comite: clean(comite), puesto: fixTitle(clean(puesto)), raw: clean(puesto) } })

const renombradosPorLista = []
const soloLista = []
const typosCorregidos = listaRows.filter(r => r.puesto !== r.raw).map(r => `"${r.raw}" → "${r.puesto}"`)

{
  // manual agrupado por comité (para el match 1:1 con la lista)
  const manualPorComite = new Map()
  for (const [key, d] of desired) {
    const ck = normComite(d.comite)
    const arr = manualPorComite.get(ck) ?? []
    arr.push({ key, d })
    manualPorComite.set(ck, arr)
  }
  const listaPorComite = new Map()
  for (const r of listaRows) {
    const ck = normComite(r.comite)
    const arr = listaPorComite.get(ck) ?? []
    arr.push(r)
    listaPorComite.set(ck, arr)
  }
  for (const [ck, items] of listaPorComite) {
    const manualItems = manualPorComite.get(ck) ?? []
    // greedy 1:1 por score descendente (evita que dos puestos de la lista
    // colapsen en la misma entrada del manual)
    const pairs = []
    for (const li of items) for (const mi of manualItems) {
      if (!sameRole(li.puesto, mi.d.puesto)) continue
      const s = similarity(li.puesto, mi.d.puesto)
      if (s >= 0.7) pairs.push({ li, mi, s })
    }
    pairs.sort((a, b) => b.s - a.s)
    const usedL = new Set(), usedM = new Set()
    for (const p of pairs) {
      if (usedL.has(p.li) || usedM.has(p.mi)) continue
      usedL.add(p.li); usedM.add(p.mi)
      if (p.mi.d.puesto !== p.li.puesto) {
        renombradosPorLista.push(`"${p.mi.d.puesto}" → "${p.li.puesto}" · ${p.li.comite} (${p.s.toFixed(2)})`)
        desired.delete(p.mi.key)
        p.mi.d.puesto = p.li.puesto
        desired.set(`${ck}|${norm(p.li.puesto)}`, p.mi.d)
      }
    }
    for (const li of items) {
      if (usedL.has(li)) continue
      const key = `${ck}|${norm(li.puesto)}`
      if (desired.has(key)) continue // ya existe idéntico en el manual
      soloLista.push(`${li.puesto} · ${li.comite}`)
      desired.set(key, {
        fuente: 'lista', comite: li.comite, puesto: li.puesto, area: null,
        fields: { description: null, study_requirement: null, functions: null, profile: null, skills: null, location: null },
      })
    }
  }
}

// ── 2. Cargar BD ─────────────────────────────────────────────────────────────
const { data: areaRows, error: aErr } = await db.from('areas')
  .select('id, name, area_type, parent_id, is_active')
if (aErr) throw aErr
const dbAreas = areaRows.filter(a => a.area_type === 'area')
const dbComites = areaRows.filter(a => a.area_type === 'committee')

const { data: posRows, error: pErr } = await db.from('service_positions')
  .select('id, area_id, title, is_active')
if (pErr) throw pErr

const { data: volRows, error: vErr } = await db.from('volunteers')
  .select('position_id, status, member:members(first_name, last_name)')
  .eq('status', 'active')
if (vErr) throw vErr
const activeByPosition = new Map()
for (const v of volRows) {
  const list = activeByPosition.get(v.position_id) ?? []
  const m = Array.isArray(v.member) ? v.member[0] : v.member
  list.push(m ? `${m.first_name} ${m.last_name}`.trim() : '(sin nombre)')
  activeByPosition.set(v.position_id, list)
}

const report = {
  areasCreadas: [], areasSoloBD: [],
  comitesCreados: [], comitesSoloBD: [], comitesDifusos: [],
  creados: [], actualizados: [], difusos: [], desactivados: [], personas: [],
  sinArea: [], duplicadosEntreHojas: overlaps,
}

// ── 3. Sync de áreas ─────────────────────────────────────────────────────────
const areaByNorm = new Map(dbAreas.map(a => [normArea(a.name), a]))
const csvAreas = [...new Set([...desired.values()].map(d => d.area).filter(Boolean))]
const titleCase = (s) => s.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase())
for (const area of csvAreas) {
  if (!areaByNorm.has(normArea(area))) {
    const name = `Área ${titleCase(area)}` // estilo de las existentes
    report.areasCreadas.push(name)
    if (APPLY) {
      const { data, error } = await db.from('areas')
        .insert({ name, area_type: 'area', is_active: true }).select('id, name').single()
      if (error) throw error
      areaByNorm.set(normArea(area), { ...data, area_type: 'area', parent_id: null })
    } else {
      areaByNorm.set(normArea(area), { id: `(nueva:${name})`, name })
    }
  }
}
const csvAreaNorms = new Set(csvAreas.map(normArea))
report.areasSoloBD = dbAreas.filter(a => !csvAreaNorms.has(normArea(a.name))).map(a => a.name)

// ── 4. Sync de comités ───────────────────────────────────────────────────────
const comiteByNorm = new Map(dbComites.map(c => [normComite(c.name), c]))
// área de cada comité del CSV: con-manual la trae; sin-manual la deduce del
// comité existente (parent_id) o de la hoja con-manual para el mismo comité.
const areaPorComite = new Map()
for (const d of desired.values()) if (d.area) areaPorComite.set(normComite(d.comite), d.area)

const csvComites = new Map() // norm → nombre canónico (limpio) del CSV
for (const d of desired.values()) if (!csvComites.has(normComite(d.comite))) csvComites.set(normComite(d.comite), d.comite)

// Renombres confirmados: el comité de BD con typo se adopta y se corrige.
for (const [cNorm, canonical] of Object.entries(COMITE_RENAME)) {
  if (comiteByNorm.has(cNorm)) continue
  const cand = dbComites.map(c => ({ c, s: similarity(c.name, canonical, { lev: true }) })).filter(x => x.s >= 0.6).sort((a, b) => b.s - a.s)[0]
  if (!cand) continue
  comiteByNorm.set(cNorm, cand.c)
  console.log(`Comité renombrado: "${cand.c.name}" → "${canonical}"${APPLY ? '' : ' (dry-run)'}`)
  if (APPLY) {
    const { error } = await db.from('areas').update({ name: canonical }).eq('id', cand.c.id)
    if (error) throw error
  }
}

for (const [cNorm, cName] of csvComites) {
  if (comiteByNorm.has(cNorm)) continue
  // ¿candidato difuso entre los comités de BD? → NO crear: confirmar manual.
  const cand = dbComites.map(c => ({ c, s: similarity(c.name, cName, { lev: true }) })).filter(x => x.s >= 0.6).sort((a, b) => b.s - a.s)[0]
  if (cand) {
    report.comitesDifusos.push({ csv: cName, bd: cand.c.name, score: cand.s.toFixed(2) })
    continue // sus puestos se saltan (quedan reportados abajo como comité sin resolver)
  }
  // área para el comité nuevo (con override manual confirmado)
  const areaCsv = areaPorComite.get(cNorm) ?? AREA_OVERRIDE[cNorm]
  const area = areaCsv ? areaByNorm.get(normArea(areaCsv)) : null
  if (!area) { report.sinArea.push(cName); continue }
  report.comitesCreados.push(`${cName} (área: ${area.name})`)
  if (APPLY) {
    const { data, error } = await db.from('areas')
      .insert({ name: cName, area_type: 'committee', parent_id: area.id, is_active: true })
      .select('id, name, parent_id').single()
    if (error) throw error
    comiteByNorm.set(cNorm, { ...data, area_type: 'committee' })
  } else {
    comiteByNorm.set(cNorm, { id: `(nuevo:${cName})`, name: cName })
  }
}
report.comitesSoloBD = dbComites
  .filter(c => c.is_active !== false && ![...csvComites.keys()].includes(normComite(c.name)))
  .map(c => c.name)

// ── 5. Sync de puestos ───────────────────────────────────────────────────────
const posByComite = new Map() // comitéId → [posiciones BD]
for (const p of posRows) {
  const list = posByComite.get(p.area_id) ?? []
  list.push(p)
  posByComite.set(p.area_id, list)
}

const matchedDbIds = new Set()
const comitesSincronizados = new Set() // ids de comités cubiertos por el manual

for (const d of desired.values()) {
  const comite = comiteByNorm.get(normComite(d.comite))
  if (!comite || String(comite.id).startsWith('(')) {
    if (!comite) continue // comité difuso pendiente: no tocar sus puestos
  }
  if (typeof comite.id === 'string' && !comite.id.startsWith('(')) comitesSincronizados.add(comite.id)
  const existentes = typeof comite.id === 'string' && !comite.id.startsWith('(') ? (posByComite.get(comite.id) ?? []) : []
  const match = existentes.find(p => norm(p.title) === norm(d.puesto))
  if (match) {
    matchedDbIds.add(match.id)
    report.actualizados.push(`${d.puesto} · ${comite.name}${match.title !== d.puesto ? ` (título: "${match.title}" → "${d.puesto}")` : ''}`)
    if (APPLY) {
      const { error } = await db.from('service_positions')
        .update({ title: d.puesto, is_active: true, ...d.fields })
        .eq('id', match.id)
      if (error) throw error
    }
  } else {
    report.creados.push(`${d.puesto} · ${comite.name}`)
    if (APPLY) {
      const { error } = await db.from('service_positions')
        .insert({ area_id: comite.id, title: d.puesto, is_active: true, ...d.fields })
      if (error) throw error
    }
  }
}

// ── 6. Puestos de BD sin match (solo en comités que el manual cubre) ─────────
const desiredByComiteId = new Map()
for (const d of desired.values()) {
  const comite = comiteByNorm.get(normComite(d.comite))
  if (!comite || String(comite.id).startsWith('(')) continue
  const list = desiredByComiteId.get(comite.id) ?? []
  list.push(d.puesto)
  desiredByComiteId.set(comite.id, list)
}
const comiteNameById = new Map([...dbComites.map(c => [c.id, c.name])])

for (const [comiteId, positions] of posByComite) {
  if (!comitesSincronizados.has(comiteId)) continue
  const deseados = desiredByComiteId.get(comiteId) ?? []
  for (const p of positions) {
    if (matchedDbIds.has(p.id) || p.is_active === false) continue
    const cand = deseados.filter(t => sameRole(p.title, t)).map(t => ({ t, s: similarity(p.title, t) })).filter(x => x.s >= 0.6).sort((a, b) => b.s - a.s)[0]
    const comiteName = comiteNameById.get(comiteId) ?? comiteId
    const gente = activeByPosition.get(p.id) ?? []
    if (cand) {
      report.difusos.push({ bd: p.title, manual: cand.t, comite: comiteName, score: cand.s.toFixed(2), servidores: gente.length })
      continue // pendiente de confirmación manual, no se toca
    }
    report.desactivados.push(`${p.title} · ${comiteName}${gente.length ? ` (${gente.length} servidor(es) activos)` : ''}`)
    for (const nombre of gente) report.personas.push({ nombre, puesto: p.title, comite: comiteName })
    // DECISIÓN TI 2026-07-28: no desactivar por ahora — solo reporte.
  }
}

// ── Reporte ──────────────────────────────────────────────────────────────────
const H = (t) => console.log(`\n━━ ${t} ━━`)
console.log(`${APPLY ? '=== CORRIDA REAL ===' : '=== DRY-RUN (nada se escribió) ==='}`)
console.log(`CSV: ${conManual.length} con-manual + ${sinManual.length} sin-manual + ${listaRows.length} lista definitiva → ${desired.size} puestos únicos (${overlaps.length} duplicados entre hojas, ganó con-manual)`)
H(`Typos corregidos de la lista (${typosCorregidos.length})`); typosCorregidos.forEach(x => console.log(' ~', x))
H(`Renombrados por la lista — nombre lista + descripción del manual (${renombradosPorLista.length})`)
renombradosPorLista.forEach(x => console.log(' ~', x))
H(`Puestos solo en la lista — se crean sin descripción (${soloLista.length})`)
soloLista.forEach(x => console.log(' +', x))
H(`Áreas a crear (${report.areasCreadas.length})`); report.areasCreadas.forEach(x => console.log(' +', x))
H(`Áreas en BD que el manual no menciona (${report.areasSoloBD.length})`); report.areasSoloBD.forEach(x => console.log(' ·', x))
H(`Comités a crear (${report.comitesCreados.length})`); report.comitesCreados.forEach(x => console.log(' +', x))
H(`Comités con match DIFUSO — confirmar manual, sus puestos NO se tocaron (${report.comitesDifusos.length})`)
report.comitesDifusos.forEach(x => console.log(` ? CSV "${x.csv}" ≈ BD "${x.bd}" (${x.score})`))
H(`Comités sin área deducible — saltados (${report.sinArea.length})`); report.sinArea.forEach(x => console.log(' !', x))
H(`Comités en BD que el manual no cubre — puestos intactos (${report.comitesSoloBD.length})`); report.comitesSoloBD.forEach(x => console.log(' ·', x))
H(`Puestos a CREAR (${report.creados.length})`); report.creados.forEach(x => console.log(' +', x))
H(`Puestos a ACTUALIZAR (${report.actualizados.length})`); report.actualizados.forEach(x => console.log(' ~', x))
H(`Match DIFUSO de puestos — confirmar manual, NO se tocan (${report.difusos.length})`)
report.difusos.forEach(x => console.log(` ? BD "${x.bd}" ≈ manual "${x.manual}" · ${x.comite} (${x.score}${x.servidores ? `, ${x.servidores} servidores` : ''})`))
H(`Puestos SIN match en el manual — candidatos a desactivar, NO se tocaron (${report.desactivados.length})`); report.desactivados.forEach(x => console.log(' -', x))
H(`Personas en esos puestos sin match — para reasignación manual (${report.personas.length})`)
report.personas.forEach(x => console.log(` ! ${x.nombre} — "${x.puesto}" · ${x.comite}`))
console.log()
