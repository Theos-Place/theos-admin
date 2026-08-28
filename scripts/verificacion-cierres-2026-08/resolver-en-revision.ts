/**
 * Intenta resolver las matrículas en_revision con la evidencia que existe.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/resolver-en-revision.ts
 *   aplicar:  ... --aplicar
 *
 * 'en_revision' es el estado que se creó para las matrículas que quedaron
 * colgadas cuando el grupo cerró sin registrar el resultado de esa persona.
 * Son 603 y van de 2014 a 2026.
 *
 * POR QUÉ SIGUEN COLGADAS. La etapa 3 de la migración aplicó las graduaciones de
 * CCB solo sobre matrículas en 'enrolled' (`abiertas = noActuales.filter(e =>
 * e.status === 'enrolled')`). Las en_revision nunca fueron candidatas, así que
 * una persona podía tener su graduación en CCB y su matrícula seguir colgada
 * acá. Este script mira justamente ese cruce.
 *
 * DOS FUENTES, y las dos con la misma regla de oro que usó la migración: el
 * grupo tiene que haber empezado ANTES de la fecha del proceso, y si hay más de
 * una candidata no se elige ninguna.
 *
 *   A) graduaciones de CCB (ccb-graduaciones-2026-08.csv) — resuelve Niveles,
 *      que son la mitad de los casos y no aparecen en el formulario.
 *   B) el formulario de fin de capacitación — resuelve capacitaciones.
 *
 * Las colas genéricas ("Reprueba Capacitación", que no dice cuál) NO se usan:
 * es la misma decisión que tomó la etapa 3 y por el mismo motivo.
 */
import { writeFileSync } from 'node:fs'
import { parsearLista, capacitacionAPlan, norm } from '../../src/lib/studies/ccb-form-parse'
import { leerCsv, planDe, DIRIGENTES_POR_EXTERNAL_ID } from '../ccb-migracion-2026-08/lib'
import { cargarEnv, leerFormularios, IndiceMiembros, todo, type Miembro } from './lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')

type Grupo = { id: string; name: string; starts_at: string | null; ends_at: string | null; plan_id: string | null; leader_id: string | null; co_leader_id: string | null }
type Enr = { id: string; member_id: string; group_id: string | null; plan_id: string | null; status: string; grade: number | null }

async function main() {
  console.log(APLICAR ? '⚠️  APLICAR\n' : '🔍 DRY-RUN — no escribe nada\n')
  const { createAdminClient } = await import('../../src/lib/supabase/admin')
  const admin = createAdminClient() as never as Parameters<typeof todo>[0]
  const raw = createAdminClient() as unknown as { from: (t: string) => never }
  const upd = (t: string) => raw.from(t) as never as {
    update: (v: unknown) => { eq: (a: string, b: string) => { eq: (c: string, d: string) => Promise<{ error: { message: string } | null }> } }
  }

  const miembros = await todo<Miembro>(admin, 'members', 'id, external_id, first_name, last_name')
  const porId = new Map(miembros.map(m => [m.id, m]))
  const porExt = new Map(miembros.filter(m => m.external_id).map(m => [String(m.external_id).trim(), m]))
  const indice = new IndiceMiembros(miembros)
  const grupos = await todo<Grupo>(admin, 'study_groups', 'id, name, starts_at, ends_at, plan_id, leader_id, co_leader_id')
  const grupoPorId = new Map(grupos.map(g => [g.id, g]))
  const planes = await todo<{ id: string; code: string }>(admin, 'study_plans', 'id, code')
  const codigoPorId = new Map(planes.map(p => [p.id, p.code]))
  const planPorCodigo = new Map(planes.map(p => [p.code, p.id]))
  const enrolls = await todo<Enr>(admin, 'study_enrollments', 'id, member_id, group_id, plan_id, status, grade')

  const enRevision = enrolls.filter(e => e.status === 'en_revision')
  const codeDe = (e: Enr) => {
    const g = e.group_id ? grupoPorId.get(e.group_id) : null
    return codigoPorId.get(g?.plan_id ?? e.plan_id ?? '') ?? null
  }
  const porMiembro = new Map<string, Enr[]>()
  for (const e of enRevision) porMiembro.set(e.member_id, [...(porMiembro.get(e.member_id) ?? []), e])

  type Fix = { id: string; quien: string; grupo: string; a: 'completed' | 'reprobado'; nota: number | null; fuente: string; detalle: string }
  const fixes = new Map<string, Fix>()
  const conflictos: string[] = []
  const proponer = (f: Fix) => {
    const previo = fixes.get(f.id)
    if (!previo) { fixes.set(f.id, f); return }
    if (previo.a !== f.a) {
      // Dos fuentes dicen cosas distintas: no se elige, se reporta.
      conflictos.push(`${f.quien} · ${f.grupo}: ${previo.fuente} dice ${previo.a}, ${f.fuente} dice ${f.a}`)
      fixes.delete(f.id)
    } else if (previo.nota === null && f.nota !== null) fixes.set(f.id, f)
  }

  // ── A) graduaciones de CCB ────────────────────────────────────────────────
  let sinPersona = 0, colaGenerica = 0, variasCandidatas = 0, fueraDeFecha = 0
  for (const g of leerCsv('ccb-graduaciones-2026-08.csv').filter(x => x.status === 'Done')) {
    const persona = porExt.get(String(g.external_id).trim())
    if (!persona) { sinPersona++; continue }
    const suyas = porMiembro.get(persona.id) ?? []
    if (!suyas.length) continue
    // Solo colas que nombran un plan concreto.
    if (/^(a|re)prueba\b/.test(norm(g.queue_name)) && !planDe(g.queue_name)) { colaGenerica++; continue }
    const code = planDe(g.queue_name)
    if (!code) continue
    const cands = suyas.filter(e => codeDe(e) === code)
    if (!cands.length) continue
    // Regla de oro de la migración: el grupo empezó ANTES del proceso.
    const conFecha = cands.filter(e => {
      const gr = e.group_id ? grupoPorId.get(e.group_id) : null
      const ini = gr?.starts_at ? String(gr.starts_at).slice(0, 10) : null
      return !!ini && !!g.fecha_due && ini < g.fecha_due
    })
    if (!conFecha.length) { fueraDeFecha++; continue }
    if (conFecha.length > 1) { variasCandidatas++; continue }
    const e = conFecha[0]
    proponer({
      id: e.id, quien: `${persona.first_name} ${persona.last_name}`,
      grupo: (e.group_id ? grupoPorId.get(e.group_id)?.name : null) ?? '(sin grupo)',
      a: g.resultado === 'aprobado' ? 'completed' : 'reprobado', nota: null,
      fuente: 'graduación CCB', detalle: `${g.queue_name} (${g.fecha_due}) · ${g.resultado}`,
    })
  }

  // ── B) formulario de fin de capacitación ──────────────────────────────────
  for (const r of leerFormularios()) {
    const code = capacitacionAPlan(r.capacitacion)
    if (!code || !r.fecha_finalizacion) continue
    const planId = planPorCodigo.get(code)
    let lider = porExt.get(String(r.dirigente_external_id).trim()) ?? null
    if (!lider) {
      const alias = DIRIGENTES_POR_EXTERNAL_ID[norm(r.dirigente_nombre)]
      lider = alias ? porExt.get(alias) ?? null : indice.buscar(r.dirigente_nombre).miembro
    }
    if (!lider) continue
    // Grupos de ese dirigente y plan cuyo fin cae cerca del reportado.
    const cands = grupos.filter(g => g.plan_id === planId && [g.leader_id, g.co_leader_id].includes(lider!.id)
      && !!g.ends_at && Math.abs((Date.parse(String(g.ends_at).slice(0, 10)) - Date.parse(r.fecha_finalizacion)) / 86400000) <= 200)
    if (cands.length !== 1) continue
    const grupo = cands[0]
    const colgadas = enRevision.filter(e => e.group_id === grupo.id)
    if (!colgadas.length) continue
    const roster = (enrolls.filter(e => e.group_id === grupo.id)
      .map(e => porId.get(e.member_id)).filter((m): m is Miembro => !!m))
    for (const [campo, destino] of [['aprobaron_texto', 'completed'], ['reprobaron_texto', 'reprobado']] as const) {
      for (const p of parsearLista(r[campo], true).personas) {
        const m = IndiceMiembros.enRoster(p.nombre, roster)
        if (!m.miembro) continue
        const e = colgadas.find(x => x.member_id === m.miembro!.id)
        if (!e) continue
        proponer({
          id: e.id, quien: `${m.miembro.first_name} ${m.miembro.last_name}`, grupo: grupo.name,
          a: destino, nota: destino === 'completed' ? p.nota : null,
          fuente: 'formulario', detalle: `${r.dirigente_nombre} · ${r.capacitacion} · ${r.fecha_finalizacion}`,
        })
      }
    }
  }

  const lista = [...fixes.values()]
  console.log('══ RESUMEN ══')
  console.log(`  matrículas en_revision:              ${enRevision.length}`)
  console.log(`  ─────────────────────────────────────`)
  console.log(`  RESOLUBLES:                          ${lista.length}`)
  console.log(`     → aprobado:  ${lista.filter(f => f.a === 'completed').length}  (con nota: ${lista.filter(f => f.a === 'completed' && f.nota !== null).length})`)
  console.log(`     → reprobado: ${lista.filter(f => f.a === 'reprobado').length}`)
  console.log(`  quedan sin resolver:                 ${enRevision.length - lista.length}`)
  console.log(`\n  por fuente: ${['graduación CCB', 'formulario'].map(f => `${f}: ${lista.filter(x => x.fuente === f).length}`).join('  ·  ')}`)
  console.log(`  descartes del cruce con CCB: cola genérica ${colaGenerica} · varias candidatas ${variasCandidatas} · grupo posterior al proceso ${fueraDeFecha} · sin persona ${sinPersona}`)
  if (conflictos.length) {
    console.log(`\n  CONFLICTOS entre fuentes (no se tocan): ${conflictos.length}`)
    for (const x of conflictos.slice(0, 10)) console.log(`    · ${x}`)
  }
  // Por qué NO se pueden resolver las demás. Sin esto, "577 sin resolver" no
  // dice si falta evidencia o si el cruce se está perdiendo algo.
  const resueltas = new Set(lista.map(f => f.id))
  const gruposConForm = new Set<string>()
  for (const r of leerFormularios()) {
    const code = capacitacionAPlan(r.capacitacion)
    if (!code || !r.fecha_finalizacion) continue
    const planId = planPorCodigo.get(code)
    let l = porExt.get(String(r.dirigente_external_id).trim()) ?? null
    if (!l) { const a = DIRIGENTES_POR_EXTERNAL_ID[norm(r.dirigente_nombre)]; l = a ? porExt.get(a) ?? null : null }
    if (!l) continue
    for (const g of grupos.filter(g => g.plan_id === planId && [g.leader_id, g.co_leader_id].includes(l!.id)
      && !!g.ends_at && Math.abs((Date.parse(String(g.ends_at).slice(0, 10)) - Date.parse(r.fecha_finalizacion)) / 86400000) <= 200)) {
      gruposConForm.add(g.id)
    }
  }
  const gradsPorPersona = new Set(leerCsv('ccb-graduaciones-2026-08.csv')
    .filter(x => x.status === 'Done').map(x => porExt.get(String(x.external_id).trim())?.id).filter(Boolean) as string[])
  const porQue = new Map<string, number>()
  for (const e of enRevision) {
    if (resueltas.has(e.id)) continue
    const tieneForm = !!e.group_id && gruposConForm.has(e.group_id)
    const tieneGrad = gradsPorPersona.has(e.member_id)
    const k = tieneForm && tieneGrad ? 'hay formulario Y graduación, pero no la nombran'
      : tieneForm ? 'hay formulario del grupo, pero no la nombra'
      : tieneGrad ? 'la persona tiene graduaciones en CCB, pero de otros estudios'
      : 'sin formulario del grupo y sin graduación en CCB'
    porQue.set(k, (porQue.get(k) ?? 0) + 1)
  }
  console.log('\n  por qué NO se resuelven las demás:')
  for (const [k, v] of [...porQue.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(4)}  ${k}`)

  console.log('\n  muestra:')
  for (const f of lista.slice(0, 15)) {
    console.log(`    ${f.quien.padEnd(30)} ${f.a.padEnd(10)} ${f.nota ?? '—'}  ${f.grupo.slice(0, 38).padEnd(40)} ${f.fuente}`)
  }

  if (!APLICAR) { console.log('\n(dry-run — no se escribió nada)'); return }

  const ruta = `scripts/output/en-revision-resueltas-${new Date().toISOString().slice(0, 10)}.json`
  writeFileSync(ruta, JSON.stringify(lista, null, 2))
  console.log(`\n  qué se escribió → ${ruta}`)
  let ok = 0, fail = 0
  for (const f of lista) {
    const patch: Record<string, unknown> = { status: f.a }
    if (f.nota !== null) patch.grade = f.nota
    // `.eq('status','en_revision')` es la guarda: solo toca lo que sigue colgado.
    const { error } = await upd('study_enrollments').update(patch).eq('id', f.id).eq('status', 'en_revision')
    if (error) { fail++; if (fail <= 5) console.log(`  ✗ ${f.quien}: ${error.message}`); continue }
    ok++
  }
  console.log(`\n  resueltas: ${ok}${fail ? ` · fallaron: ${fail}` : ''}`)
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
