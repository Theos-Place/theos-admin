/**
 * Migrar las NOTAS del formulario "EB — Fin de Capacitación" a
 * study_enrollments.grade.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/migrar-notas.ts
 *   aplicar:  ... --aplicar
 *
 * El dato existe desde 2018 y nunca se migró: la base tiene 252 notas en total
 * y solo las listas de aprobados del formulario traen más de 400.
 *
 * LO DIFÍCIL NO ES LA NOTA, ES EL GRUPO. Un dirigente da el mismo estudio
 * varias veces, así que "mismo dirigente + mismo plan" no identifica una
 * cohorte. Y las cohortes se repiten enteras: en el Discípulos 2 de Guiselle
 * Trejos, la MISMA gente llevó el curso dos veces, y emparejar por nombres
 * eligió el grupo equivocado. Por eso acá:
 *
 *   1. Los candidatos son los grupos de ese dirigente y ese plan.
 *   2. Se puntean por dos señales a la vez: cuánta de la gente del formulario
 *      está en el grupo, y qué tan cerca está la fecha de fin reportada de la
 *      fecha de fin del grupo.
 *   3. Se acepta SOLO si el mejor gana claro. Si dos grupos empatan en gente y
 *      la fecha no los separa —el caso Guiselle— no se elige ninguno.
 *
 * Y sobre la nota misma:
 *   · nunca pisa una nota que ya existe (solo escribe donde grade IS NULL);
 *   · solo a quien está APROBADO en ese grupo — una nota sobre una matrícula
 *     reprobada o retirada diría algo que el formulario no dice;
 *   · nada de escalas 0-10 (ver leerNota en ccb-form-parse.ts).
 */
import { writeFileSync } from 'node:fs'
import { parsearLista, capacitacionAPlan } from '../../src/lib/studies/ccb-form-parse'
import { leerCsv, DIRIGENTES_POR_EXTERNAL_ID } from '../ccb-migracion-2026-08/lib'
import { norm } from '../../src/lib/studies/ccb-form-parse'
import { cargarEnv, IndiceMiembros, todo, type Miembro } from './lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')

/** Mínimo de gente del formulario que tiene que estar en el grupo. */
const OVERLAP_MIN = 0.6
/** La fecha reportada tiene que caer cerca del fin del grupo. */
const DIAS_MAX = 200
/** Para desempatar dos grupos con la misma gente: uno tiene que estar MUCHO
 *  más cerca en fecha que el otro. Si no, no se elige. */
const DIAS_DESEMPATE = 120

type Grupo = { id: string; name: string; status: string; starts_at: string | null; ends_at: string | null; plan_id: string | null; leader_id: string | null; co_leader_id: string | null }
type Enr = { id: string; member_id: string; group_id: string | null; status: string; grade: number | null }

const dias = (a: string, b: string) => Math.abs((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000)

async function main() {
  console.log(APLICAR ? '⚠️  APLICAR\n' : '🔍 DRY-RUN — no escribe nada\n')
  const { createAdminClient } = await import('../../src/lib/supabase/admin')
  const admin = createAdminClient() as never as Parameters<typeof todo>[0]
  const raw = createAdminClient() as unknown as { from: (t: string) => never }
  const upd = (t: string) => raw.from(t) as never as {
    update: (v: unknown) => { eq: (a: string, b: string) => { is: (c: string, d: null) => Promise<{ error: { message: string } | null }> } }
  }

  const miembros = await todo<Miembro>(admin, 'members', 'id, external_id, first_name, last_name')
  const porId = new Map(miembros.map(m => [m.id, m]))
  const porExt = new Map(miembros.filter(m => m.external_id).map(m => [String(m.external_id).trim(), m]))
  const indice = new IndiceMiembros(miembros)
  const grupos = await todo<Grupo>(admin, 'study_groups', 'id, name, status, starts_at, ends_at, plan_id, leader_id, co_leader_id')
  const planes = await todo<{ id: string; code: string }>(admin, 'study_plans', 'id, code')
  const planPorCodigo = new Map(planes.map(p => [p.code, p.id]))
  const enrolls = await todo<Enr>(admin, 'study_enrollments', 'id, member_id, group_id, status, grade')
  const porGrupo = new Map<string, Enr[]>()
  for (const e of enrolls) if (e.group_id) porGrupo.set(e.group_id, [...(porGrupo.get(e.group_id) ?? []), e])

  const filas = leerCsv('ccb-form-fin-capacitacion.csv')

  type Escritura = { enrollmentId: string; quien: string; grupo: string; nota: number; fecha: string }
  const escrituras: Escritura[] = []
  const motivos = new Map<string, number>()
  const noEncaja: string[] = []
  const sube = (k: string) => motivos.set(k, (motivos.get(k) ?? 0) + 1)

  for (const r of filas) {
    const code = capacitacionAPlan(r.capacitacion)
    if (!code) { sube('sin plan'); continue }
    const planId = planPorCodigo.get(code)
    if (!planId) { sube('plan inexistente'); continue }

    let lider = porExt.get(String(r.dirigente_external_id).trim()) ?? null
    if (!lider) {
      const alias = DIRIGENTES_POR_EXTERNAL_ID[norm(r.dirigente_nombre)]
      lider = alias ? porExt.get(alias) ?? null : indice.buscar(r.dirigente_nombre).miembro
    }
    if (!lider) { sube('dirigente sin resolver'); continue }
    if (!r.fecha_finalizacion) { sube('sin fecha de finalización'); continue }

    // Solo los aprobados CON nota: es lo único que este script migra.
    const conNota = parsearLista(r.aprobaron_texto, true).personas.filter(p => p.nota !== null)
    if (!conNota.length) { sube('sin notas en el formulario'); continue }

    const candidatos = grupos.filter(g =>
      g.plan_id === planId && [g.leader_id, g.co_leader_id].includes(lider!.id))
    if (!candidatos.length) { sube('sin grupo de ese dirigente y plan'); continue }

    const punteados = candidatos.map(g => {
      const ins = porGrupo.get(g.id) ?? []
      const roster = ins.map(e => porId.get(e.member_id)).filter((m): m is Miembro => !!m)
      const hits = conNota.filter(p => IndiceMiembros.enRoster(p.nombre, roster).miembro).length
      const delta = g.ends_at ? dias(String(g.ends_at).slice(0, 10), r.fecha_finalizacion) : Infinity
      return { g, ins, roster, overlap: hits / conNota.length, delta }
    }).filter(c => c.overlap >= OVERLAP_MIN && c.delta <= DIAS_MAX)

    if (!punteados.length) { sube('ningún grupo con gente y fecha que calcen'); continue }
    // Cuántas veces hubo que elegir de verdad: si esto fuera 0, el desempate
    // nunca se ejercita y no sabríamos si sirve.
    if (punteados.length > 1) sube(`~elección entre ${punteados.length} candidatos`)
    punteados.sort((a, b) => (b.overlap - a.overlap) || (a.delta - b.delta))
    const [mejor, segundo] = punteados
    if (segundo && Math.abs(segundo.overlap - mejor.overlap) < 0.15
        && Math.abs(segundo.delta - mejor.delta) < DIAS_DESEMPATE) {
      // El caso Guiselle: dos cohortes iguales y la fecha no las separa.
      noEncaja.push(`${r.dirigente_nombre} · ${r.capacitacion} · ${r.fecha_finalizacion} → empate entre "${mejor.g.name}" y "${segundo.g.name}"`)
      sube('empate entre dos grupos')
      continue
    }

    let escritas = 0
    for (const p of conNota) {
      const m = IndiceMiembros.enRoster(p.nombre, mejor.roster)
      if (!m.miembro) continue
      const e = mejor.ins.find(x => x.member_id === m.miembro!.id)
      if (!e) continue
      if (e.grade !== null) { sube('ya tenía nota'); continue }
      if (e.status !== 'completed') { sube(`no está aprobado (${e.status})`); continue }
      escrituras.push({
        enrollmentId: e.id, quien: `${m.miembro.first_name} ${m.miembro.last_name}`,
        grupo: mejor.g.name, nota: p.nota!, fecha: r.fecha_finalizacion,
      })
      escritas++
    }
    if (escritas) sube('OK')
  }

  console.log('══ RESUMEN ══')
  console.log(`  notas a escribir: ${escrituras.length}`)
  console.log('\n  por qué se descartó el resto:')
  for (const [k, v] of [...motivos.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(v).padStart(4)}  ${k}`)
  }
  if (noEncaja.length) {
    console.log(`\n  empates que NO se resuelven solos (${noEncaja.length}):`)
    for (const x of noEncaja.slice(0, 10)) console.log(`    · ${x}`)
    if (noEncaja.length > 10) console.log(`    … y ${noEncaja.length - 10} más`)
  }
  // ── controles antes de tocar nada ──────────────────────────────────────
  // 1) La misma matrícula con DOS notas distintas: pasa si dos formularios
  //    reclaman el mismo grupo. Es un empate no detectado, no un dato.
  const porEnrollment = new Map<string, Escritura[]>()
  for (const e of escrituras) porEnrollment.set(e.enrollmentId, [...(porEnrollment.get(e.enrollmentId) ?? []), e])
  const chocan = [...porEnrollment.values()].filter(v => new Set(v.map(x => x.nota)).size > 1)
  // 2) Notas fuera del rango que tiene la base hoy (70 a 105,2). Una nota de 42
  //    en una lista de APROBADOS no se entiende sola y no se escribe.
  const RANGO_MIN = 70
  const fuera = escrituras.filter(e => e.nota < RANGO_MIN)
  console.log(`\n══ CONTROLES ══`)
  console.log(`  matrículas con dos notas distintas: ${chocan.length}`)
  for (const v of chocan.slice(0, 8)) console.log(`    · ${v[0].quien}: ${v.map(x => `${x.nota} (${x.grupo.slice(0, 34)})`).join(' vs ')}`)
  console.log(`  notas por debajo de ${RANGO_MIN} (la base va de 70 a 105,2): ${fuera.length}`)
  for (const e of fuera.slice(0, 10)) console.log(`    · ${e.quien}: ${e.nota} — ${e.grupo.slice(0, 44)}`)
  const grupos_ = new Set(escrituras.map(e => e.grupo))
  const notas = escrituras.map(e => e.nota).sort((a, b) => a - b)
  console.log(`  grupos afectados: ${grupos_.size} · nota mín ${notas[0]} · mediana ${notas[Math.floor(notas.length / 2)]} · máx ${notas[notas.length - 1]}`)
  const porAnio = new Map<string, number>()
  for (const e of escrituras) porAnio.set(e.fecha.slice(0, 4), (porAnio.get(e.fecha.slice(0, 4)) ?? 0) + 1)
  console.log(`  por año del cierre reportado: ${[...porAnio.entries()].sort().map(([a, n]) => `${a}:${n}`).join('  ')}`)

  console.log('\n  muestra de lo que se escribiría:')
  for (const e of escrituras.slice(0, 12)) {
    console.log(`    ${e.quien.padEnd(32)} ${String(e.nota).padStart(6)}  ${e.grupo.slice(0, 44)}`)
  }

  // Se sacan del lote: una nota fuera de rango o en disputa se reporta, no se
  // escribe. Son pocas y cada una es una decisión de alguien, no un default.
  const enDisputa = new Set(chocan.flatMap(v => v.map(x => x.enrollmentId)))
  const finales = escrituras.filter(e => e.nota >= RANGO_MIN && !enDisputa.has(e.enrollmentId))
  console.log(`\n  → se escribirían ${finales.length} de ${escrituras.length} (se excluyen ${escrituras.length - finales.length}: fuera de rango o en disputa)`)

  if (!APLICAR) { console.log('\n(dry-run — no se escribió nada)'); return }

  const ruta = `scripts/output/notas-migradas-${new Date().toISOString().slice(0, 10)}.json`
  writeFileSync(ruta, JSON.stringify(finales, null, 2))
  console.log(`\n  qué se escribió → ${ruta}`)

  let ok = 0, fail = 0
  for (const e of finales) {
    // `.is('grade', null)` es la guarda final: nunca pisa una nota existente.
    const { error } = await upd('study_enrollments').update({ grade: e.nota }).eq('id', e.enrollmentId).is('grade', null)
    if (error) { fail++; if (fail <= 5) console.log(`  ✗ ${e.quien}: ${error.message}`); continue }
    ok++
  }
  console.log(`\n  notas escritas: ${ok}${fail ? ` · fallaron: ${fail}` : ''}`)
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
