/**
 * One-off: escribe la nota de Panorama del export de CCB en la inscripción al plan
 * PAN (study_enrollments.grade), no en el perfil del miembro.
 *
 * Uso (OJO con NODE_OPTIONS: los módulos de queries hacen `import 'server-only'`):
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/import-panorama-grades-2026-08.ts
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/import-panorama-grades-2026-08.ts --commit
 *
 * Requiere la migración 20260804090000: grade era numeric(4,2) y 22 notas de 100+
 * no caben ahí.
 *
 * REGLAS (confirmadas por TI el 2026-08-04):
 *   · Nota numérica → grade de la inscripción a PAN.
 *   · "reprobo"     → status = 'reprobado' (ya existe en el CHECK), sin grade: no
 *                     es una nota.
 *   · "no hay registro de nota" y vacío → no se escribe nada, grade queda null.
 *
 * Con VARIAS inscripciones a PAN (23 miembros los tienen, uno con cuatro) se
 * escribe en la MÁS RECIENTE completada. La nota de CCB es un valor por persona:
 * copiarla a las cuatro inventaría datos que nadie registró.
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

const CSV = 'data-import/servidores-actualizacion-2026-08.csv'
const PAN_PLAN = '6a4878ba-da7e-41a0-a7ed-461888f52935'

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

type Enrollment = {
  id: string; member_id: string; status: string
  enrolled_at: string | null; completed_at: string | null; grade: number | null
}

async function main() {
  const commit = process.argv.includes('--commit')
  const { parseNotaPanorama } = await import('../src/lib/import/ccb-personal-data')
  const { createAdminClient } = await import('../src/lib/supabase/admin')
  const db = createAdminClient()

  // ── CSV ───────────────────────────────────────────────────────────────────
  const rows = parseCsv(readFileSync(CSV, 'utf8'))
  const H = rows[0].map(h => h.replace(/^﻿/, '').trim())
  const iId = H.indexOf('Individual ID')
  const iNota = H.indexOf('Custom Fields - Nota Panorama')
  const iFirst = H.indexOf('First Name'), iLast = H.indexOf('Last Name')
  if (iId < 0 || iNota < 0) throw new Error(`Falta una columna. El CSV tiene: ${H.join(' | ')}`)

  const csvRows = rows.slice(1).map((r, i) => ({
    linea: i + 2,
    ccbId: (r[iId] ?? '').trim(),
    nota: (r[iNota] ?? '').trim(),
    nombreCsv: `${(r[iFirst] ?? '').trim()} ${(r[iLast] ?? '').trim()}`.trim(),
  }))

  // ── Miembros por external_id ──────────────────────────────────────────────
  const ids = csvRows.map(r => r.ccbId).filter(Boolean)
  const byExternal = new Map<string, { id: string; nombre: string }>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from('members')
      .select('id, first_name, last_name, external_id')
      .in('external_id', ids.slice(i, i + 200))
    if (error) throw error
    for (const m of (data ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null; external_id: string }>) {
      byExternal.set(m.external_id.trim(), { id: m.id, nombre: `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() })
    }
  }

  // ── Inscripciones a PAN ───────────────────────────────────────────────────
  const enrollments: Enrollment[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('study_enrollments')
      .select('id, member_id, status, enrolled_at, completed_at, grade')
      .eq('plan_id', PAN_PLAN).order('id').range(from, from + 999)
    if (error) throw error
    const page = (data ?? []) as Enrollment[]
    enrollments.push(...page)
    if (page.length < 1000) break
  }
  const porMiembro = new Map<string, Enrollment[]>()
  for (const e of enrollments) porMiembro.set(e.member_id, [...(porMiembro.get(e.member_id) ?? []), e])

  /** La inscripción donde va la nota: la más reciente completada; si no hay
   *  completada, la más reciente de cualquier estado. */
  function elegir(list: Enrollment[]): Enrollment {
    const fecha = (e: Enrollment) => e.completed_at ?? e.enrolled_at ?? ''
    const completadas = list.filter(e => e.status === 'completed')
    const pool = completadas.length ? completadas : list
    return [...pool].sort((a, b) => (fecha(a) < fecha(b) ? 1 : fecha(a) > fecha(b) ? -1 : a.id < b.id ? 1 : -1))[0]
  }

  // ── Plan de escritura ─────────────────────────────────────────────────────
  type Accion =
    | { tipo: 'grade'; enr: Enrollment; nombre: string; valor: number; nota: string; deVarias: number }
    | { tipo: 'reprobado'; enr: Enrollment; nombre: string; nota: string; deVarias: number }
  const acciones: Accion[] = []
  const sinInscripcion: Array<{ ccbId: string; nombre: string; nota: string }> = []
  const sinMiembro: Array<{ ccbId: string; nombre: string; nota: string }> = []
  const sinDato: string[] = []
  const textoRaro: Array<{ nombre: string; nota: string }> = []
  const yaTenia: Array<{ nombre: string; actual: number; nueva: string }> = []
  const noCompletada: Array<{ nombre: string; status: string; nota: string }> = []

  for (const row of csvRows) {
    const n = parseNotaPanorama(row.nota)
    if (n.kind === 'vacio' || n.kind === 'sin_registro') { sinDato.push(row.ccbId); continue }

    const m = byExternal.get(row.ccbId)
    if (!m) { sinMiembro.push({ ccbId: row.ccbId, nombre: row.nombreCsv, nota: row.nota }); continue }
    const list = porMiembro.get(m.id) ?? []
    if (list.length === 0) { sinInscripcion.push({ ccbId: row.ccbId, nombre: m.nombre, nota: row.nota }); continue }
    const enr = elegir(list)

    if (n.kind === 'texto') { textoRaro.push({ nombre: m.nombre, nota: row.nota }); continue }
    if (enr.grade != null) { yaTenia.push({ nombre: m.nombre, actual: enr.grade, nueva: row.nota }); continue }
    if (enr.status !== 'completed') noCompletada.push({ nombre: m.nombre, status: enr.status, nota: row.nota })

    if (n.kind === 'reprobado') {
      acciones.push({ tipo: 'reprobado', enr, nombre: m.nombre, nota: row.nota, deVarias: list.length })
    } else {
      acciones.push({ tipo: 'grade', enr, nombre: m.nombre, valor: n.value, nota: row.nota, deVarias: list.length })
    }
  }

  // ── Reporte ───────────────────────────────────────────────────────────────
  const L = (s = '') => console.log(s)
  const grades = acciones.filter(a => a.tipo === 'grade')
  const reprob = acciones.filter(a => a.tipo === 'reprobado')
  L(`CSV: ${CSV} — ${csvRows.length} filas`)
  L(`Inscripciones a PAN en el sistema: ${enrollments.length}`)
  L()
  L('── A ESCRIBIR ──────────────────────────────────────')
  L(`  grade (nota numérica)      : ${grades.length}`)
  L(`  status='reprobado'         : ${reprob.length}`)
  for (const r of reprob) L(`    · ${r.nombre} (CSV decía "${r.nota}")`)
  L()
  L('── SIN ESCRIBIR ────────────────────────────────────')
  L(`  Sin nota o "no hay registro": ${sinDato.length}  (grade queda en null)`)
  L(`  Texto que no es nota        : ${textoRaro.length}`)
  for (const t of textoRaro) L(`    · ${t.nombre}: "${t.nota}"`)
  L(`  Con nota pero sin inscripción a PAN: ${sinInscripcion.length}`)
  for (const s of sinInscripcion) L(`    · ${s.nombre} (CCB ${s.ccbId}) traía ${s.nota}`)
  if (sinMiembro.length) {
    L(`  Sin miembro en el padrón    : ${sinMiembro.length}`)
    for (const s of sinMiembro) L(`    · CCB ${s.ccbId} ${s.nombre}`)
  }
  if (yaTenia.length) {
    L(`  Ya tenían grade (no se pisa): ${yaTenia.length}`)
    for (const y of yaTenia) L(`    · ${y.nombre}: tiene ${y.actual}, el CSV trae ${y.nueva}`)
  }

  const varias = acciones.filter(a => a.deVarias > 1)
  if (varias.length) {
    L()
    L(`── CON VARIAS INSCRIPCIONES A PAN (${varias.length}) ──`)
    L('   La nota va en la más reciente completada.')
    for (const v of varias) L(`    · ${v.nombre}: ${v.deVarias} inscripciones`)
  }
  if (noCompletada.length) {
    L()
    L(`── NOTA EN UNA INSCRIPCIÓN NO COMPLETADA (${noCompletada.length}) ──`)
    L('   Se escribe la nota igual, pero el status queda como está: cerrarlo es')
    L('   otra decisión.')
    for (const n of noCompletada) L(`    · ${n.nombre}: status="${n.status}", nota ${n.nota}`)
  }

  const sobre100 = grades.filter(a => a.tipo === 'grade' && a.valor > 99.99)
  L()
  L(`  Notas sobre 99.99 (requieren la migración 20260804090000): ${sobre100.length}`)
  L(`  Rango: ${Math.min(...grades.map(a => (a.tipo === 'grade' ? a.valor : 0)))} – ${Math.max(...grades.map(a => (a.tipo === 'grade' ? a.valor : 0)))}`)

  L()
  if (!commit) {
    L('DRY-RUN: no se escribió NADA. Volvé a correrlo con --commit.')
    return
  }

  let ok = 0
  const fallos: Array<{ nombre: string; error: string }> = []
  for (const a of acciones) {
    const patch = a.tipo === 'grade' ? { grade: a.valor } : { status: 'reprobado' }
    const { error } = await db.from('study_enrollments').update(patch).eq('id', a.enr.id)
    if (error) fallos.push({ nombre: a.nombre, error: error.message })
    else ok++
  }
  L(`✓ Escritas ${ok} de ${acciones.length} inscripciones.`)
  if (fallos.length) {
    L(`✗ ${fallos.length} fallaron:`)
    for (const f of fallos) L(`    · ${f.nombre}: ${f.error}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
