/**
 * Las 6 respuestas NUEVAS del formulario "EB — Fin de Nivel 4" (archivo del
 * 2026-08-31) contra los grupos del sistema. SOLO ANALIZA: no escribe nada.
 *
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/nuevos-nivel4.ts
 *
 * Cuatro de las seis vienen SIN dirigente ("Profile Matched to" vacío), así que
 * no se puede emparejar por quién la llenó. Se empareja por la LISTA: se busca
 * el grupo abierto cuyo roster contenga a la mayor cantidad de nombres
 * reportados. Es el mismo criterio que se usó para migrar las notas, y ahí
 * siempre dio un único candidato.
 */
import { parsearLista } from '../../src/lib/studies/ccb-form-parse'
import { leerCsv } from '../ccb-migracion-2026-08/lib'
import { cargarEnv, IndiceMiembros, todo, type Miembro } from './lib'

cargarEnv()

const SOLO_NUEVAS = process.argv.includes('--solo-nuevas')
const NUEVAS = ['95366', '95368', '95376', '95379', '95383', '95390']

type Grupo = { id: string; name: string; status: string; starts_at: string | null; plan_id: string | null; leader_id: string | null; co_leader_id: string | null }
type Enr = { id: string; member_id: string; group_id: string | null; status: string }

async function main() {
  const { createAdminClient } = await import('../../src/lib/supabase/admin')
  const admin = createAdminClient() as never as Parameters<typeof todo>[0]

  const miembros = await todo<Miembro>(admin, 'members', 'id, external_id, first_name, last_name')
  const porId = new Map(miembros.map(m => [m.id, m]))
  const grupos = await todo<Grupo>(admin, 'study_groups', 'id, name, status, starts_at, plan_id, leader_id, co_leader_id')
  const enrolls = await todo<Enr>(admin, 'study_enrollments', 'id, member_id, group_id, status')
  const planes = await todo<{ id: string; code: string; name: string }>(admin, 'study_plans', 'id, code, name')
  const planPorId = new Map(planes.map(p => [p.id, p]))

  const porGrupo = new Map<string, Enr[]>()
  for (const e of enrolls) {
    if (!e.group_id) continue
    const a = porGrupo.get(e.group_id) ?? []; a.push(e); porGrupo.set(e.group_id, a)
  }
  const abiertos = grupos.filter(g => g.status !== 'finalizado')
  console.log(`grupos abiertos: ${abiertos.length}\n`)

  const filas = leerCsv('ccb-form-fin-nivel4.csv')
    .filter(r => !SOLO_NUEVAS || NUEVAS.includes(String(r.response_id).trim()))
  console.log(`respuestas a evaluar: ${filas.length}\n`)

  // Candidatos (respuesta → grupo). Un grupo puede recibir varias respuestas y
  // una respuesta puede parecerse a varios grupos: se queda el mejor par por
  // grupo, y solo si la cobertura es COMPLETA.
  type Cand = { resp: string; fecha: string; grupo: Grupo; hits: number; total: number; faltan: string[]; repro: number }
  const mejorPorGrupo = new Map<string, Cand>()
  const parciales: Cand[] = []

  for (const r of filas) {
    const aprob = parsearLista(r.aprobaron_texto, true).personas
    const repro = parsearLista(r.reprobaron_texto, true).personas
    if (!aprob.length && !repro.length) continue

    for (const g of abiertos) {
      const ins = porGrupo.get(g.id) ?? []
      const roster = ins.map(e => porId.get(e.member_id)).filter((m): m is Miembro => !!m)
      if (!roster.length) continue
      const decididos = new Set<string>()
      let hits = 0
      for (const p of aprob) { const m = IndiceMiembros.enRoster(p.nombre, roster).miembro; if (m) { hits++; decididos.add(m.id) } }
      for (const p of repro) { const m = IndiceMiembros.enRoster(p.nombre, roster).miembro; if (m) decididos.add(m.id) }
      if (hits < 2) continue
      // La fecha del formulario tiene que ser POSTERIOR al inicio del grupo:
      // sin esto una respuesta vieja calza con una cohorte nueva del mismo
      // dirigente y con casi la misma gente.
      if (g.starts_at && r.fecha_finalizacion && r.fecha_finalizacion < String(g.starts_at).slice(0, 10)) continue

      const cursando = ins.filter(e => e.status === 'enrolled' || e.status === 'pendiente_de_pago')
      const faltan = cursando.filter(e => !decididos.has(e.member_id))
        .map(e => `${porId.get(e.member_id)?.first_name} ${porId.get(e.member_id)?.last_name}`)
      const c: Cand = { resp: String(r.response_id), fecha: r.fecha_finalizacion, grupo: g, hits, total: aprob.length, faltan, repro: repro.length }
      if (faltan.length) { parciales.push(c); continue }
      const prev = mejorPorGrupo.get(g.id)
      if (!prev || c.hits > prev.hits) mejorPorGrupo.set(g.id, c)
    }
  }

  const listos = [...mejorPorGrupo.values()].sort((a, b) => a.grupo.name.localeCompare(b.grupo.name))
  console.log(`\n${'='.repeat(78)}\nCIERRAN COMPLETO: ${listos.length} grupos\n${'='.repeat(78)}`)
  for (const c of listos) {
    const plan = c.grupo.plan_id ? planPorId.get(c.grupo.plan_id) : null
    console.log(`  ${(plan?.code ?? '?').padEnd(7)} ${c.grupo.name}`)
    console.log(`          resp ${c.resp} · fin ${c.fecha} · ${c.hits} aprobados${c.repro ? ` · ${c.repro} no aprobados` : ''}`)
  }

  // Grupos que solo tienen candidatos incompletos: se listan para mirarlos.
  const cubiertos = new Set(listos.map(c => c.grupo.id))
  const porGrupoParcial = new Map<string, Cand>()
  for (const c of parciales) {
    if (cubiertos.has(c.grupo.id)) continue
    const prev = porGrupoParcial.get(c.grupo.id)
    if (!prev || c.hits > prev.hits) porGrupoParcial.set(c.grupo.id, c)
  }
  const incompletos = [...porGrupoParcial.values()].sort((a, b) => a.faltan.length - b.faltan.length)
  console.log(`\n${'='.repeat(78)}\nCON GENTE SIN EXPLICAR: ${incompletos.length} grupos (NO se tocan)\n${'='.repeat(78)}`)
  for (const c of incompletos) {
    console.log(`  ${c.grupo.name} — resp ${c.resp}, ${c.hits}/${c.total} · faltan ${c.faltan.length}: ${c.faltan.slice(0, 6).join(', ')}`)
  }
  console.log(`\ngrupos abiertos sin ninguna respuesta que los respalde: ${abiertos.length - listos.length - incompletos.length}`)
}

main().catch(e => { console.error(e); process.exit(1) })
