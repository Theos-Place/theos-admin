/**
 * Informe del formulario "EB — Fin de Nivel" (N1/N2/N3 y Discípulos).
 * SOLO ANALIZA: no escribe una sola fila.
 *
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/informe-fin-de-nivel.ts
 *
 * Es OTRO formulario que el de Nivel 4, con dos diferencias que cambian cómo se
 * lee:
 *
 *  · pregunta el nivel que van a INICIAR, no el que terminaron. "2" significa
 *    que cerraron Nivel 1. Se traduce acá, y lo que no se reconoce se REPORTA
 *    en vez de adivinarse;
 *  · no trae fecha de finalización, sino "Fecha de inicio" — la del grupo
 *    NUEVO. Sirve igual para descartar respuestas viejas contra cohortes
 *    nuevas, pero es una fecha distinta y por eso se compara distinto.
 */
import XLSX from 'xlsx'
import { readFileSync } from 'node:fs'
import { parsearLista } from '../../src/lib/studies/ccb-form-parse'
import { cargarEnv, IndiceMiembros, todo, type Miembro } from './lib'

cargarEnv()

/** "Nivel que van a iniciar" → código del plan que TERMINARON. */
function nivelTerminado(txt: string): string | null {
  const t = txt.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
  if (!t) return null
  // DISCÍPULOS PRIMERO, y con el numeral romano contemplado. BUG de la primera
  // corrida: la expresión estaba mal escrita, no matcheaba "discipulos", y las
  // 67 respuestas de Discípulos caían en el atajo numérico de abajo — o sea
  // "Discípulos 2" se leía como Nivel 1. Se detectó porque el informe reportaba
  // cero cierres de Discípulos en un archivo que, según quien lo mandó, los
  // traía.
  const dis = t.match(/dis[a-z]*pulos?\s*(iii|ii|i|[123])\b/)
  if (dis) {
    const n = { iii: 3, ii: 2, i: 1, '1': 1, '2': 2, '3': 3 }[dis[1]]
    // Iniciar Discípulos N significa haber cerrado el anterior; iniciar
    // Discípulos 1 significa haber cerrado Nivel 4.
    return n === 1 ? 'N4' : n === 2 ? 'DIS1' : 'DIS2'
  }
  if (/liderazgo de jesus|sirviendo como jesus|\bscj\b/.test(t)) return 'N4'
  if (/panorama|transformados/.test(t)) return null   // otra cadena: no se traduce
  // "2", "nivel 2", "segundo nivel", "2do", "4to", "3 nivel", "niel 03"…
  const m = t.match(/(^|[^0-9])0?([1-4])([^0-9]|$)/)
  if (m) return ({ '2': 'N1', '3': 'N2', '4': 'N3' } as Record<string, string>)[m[2]] ?? null
  if (/segundo|\bdos\b/.test(t)) return 'N1'
  if (/tercer|\btres\b/.test(t)) return 'N2'
  if (/cuarto|\bcuatro\b/.test(t)) return 'N3'
  return null
}

type Grupo = { id: string; name: string; status: string; starts_at: string | null; plan_id: string | null }
type Enr = { id: string; member_id: string; group_id: string | null; status: string }

async function main() {
  const wb = XLSX.read(readFileSync('data-import/ccb-form-fin-nivel.xlsx'), { type: 'buffer' })
  const aoa = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false })
  const filas = aoa.slice(4).filter(r => String(r[2] ?? '').trim())
  console.log(`respuestas en el archivo: ${filas.length}`)

  const sinMapear = new Map<string, number>()
  const respuestas = filas.map(r => {
    const crudo = String(r[11] ?? '').trim() || String(r[12] ?? '').trim()
    const code = nivelTerminado(crudo)
    if (!code && crudo) sinMapear.set(crudo, (sinMapear.get(crudo) ?? 0) + 1)
    return {
      id: String(r[2]).trim(), dirigente: String(r[4] ?? '').trim(), crudo, code,
      inicioNuevo: String(r[13] ?? '').trim().slice(0, 10),
      aprobaron: String(r[16] ?? ''), reprobaron: String(r[17] ?? ''),
    }
  })
  const porNivel = new Map<string, number>()
  for (const r of respuestas) porNivel.set(r.code ?? '(no reconocido)', (porNivel.get(r.code ?? '(no reconocido)') ?? 0) + 1)
  console.log('\nnivel que CERRARON (traducido del que iban a iniciar):')
  for (const [k, v] of [...porNivel].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`)
  if (sinMapear.size) {
    console.log('\ntextos que NO se reconocieron (no se adivinan):')
    for (const [k, v] of [...sinMapear].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`  ${String(v).padStart(3)}  "${k}"`)
  }

  const { createAdminClient } = await import('../../src/lib/supabase/admin')
  const admin = createAdminClient() as never as Parameters<typeof todo>[0]
  const miembros = await todo<Miembro>(admin, 'members', 'id, external_id, first_name, last_name')
  const porId = new Map(miembros.map(m => [m.id, m]))
  const grupos = await todo<Grupo>(admin, 'study_groups', 'id, name, status, starts_at, plan_id')
  const enrolls = await todo<Enr>(admin, 'study_enrollments', 'id, member_id, group_id, status')
  const planes = await todo<{ id: string; code: string }>(admin, 'study_plans', 'id, code')
  const planPorId = new Map(planes.map(p => [p.id, p.code]))

  const porGrupo = new Map<string, Enr[]>()
  for (const e of enrolls) { if (!e.group_id) continue; const a = porGrupo.get(e.group_id) ?? []; a.push(e); porGrupo.set(e.group_id, a) }
  const abiertos = grupos.filter(g => g.status !== 'finalizado')
  console.log(`\ngrupos abiertos en el sistema: ${abiertos.length}`)

  type Cand = { resp: string; grupo: Grupo; hits: number; total: number; faltan: string[]; sobran: string[]; repro: number }
  const mejor = new Map<string, Cand>()
  const parciales: Cand[] = []

  for (const r of respuestas) {
    const aprob = parsearLista(r.aprobaron, true).personas
    const repro = parsearLista(r.reprobaron, true).personas
    if (aprob.length + repro.length < 2) continue
    for (const g of abiertos) {
      // El plan del grupo tiene que ser el que la respuesta dice haber cerrado.
      if (r.code && planPorId.get(g.plan_id ?? '') !== r.code) continue
      const ins = porGrupo.get(g.id) ?? []
      const roster = ins.map(e => porId.get(e.member_id)).filter((m): m is Miembro => !!m)
      if (!roster.length) continue
      const decididos = new Set<string>(); const sobran: string[] = []
      let hits = 0
      for (const p of aprob) { const m = IndiceMiembros.enRoster(p.nombre, roster).miembro; if (m) { hits++; decididos.add(m.id) } else sobran.push(p.nombre) }
      for (const p of repro) { const m = IndiceMiembros.enRoster(p.nombre, roster).miembro; if (m) decididos.add(m.id); else sobran.push(p.nombre) }
      if (hits < 2) continue
      const cursando = ins.filter(e => e.status === 'enrolled' || e.status === 'pendiente_de_pago')
      const faltan = cursando.filter(e => !decididos.has(e.member_id))
        .map(e => `${porId.get(e.member_id)?.first_name} ${porId.get(e.member_id)?.last_name}`)
      const c: Cand = { resp: r.id, grupo: g, hits, total: aprob.length + repro.length, faltan, sobran, repro: repro.length }
      // Sin nadie sin explicar, el grupo entero está cubierto: eso ya es la
      // evidencia más fuerte que hay y no necesita otro umbral.
      if (!faltan.length) {
        const prev = mejor.get(g.id)
        if (!prev || c.hits > prev.hits) mejor.set(g.id, c)
        continue
      }
      // Para los PARCIALES sí hace falta un piso, y se mide contra el GRUPO, no
      // contra la lista del formulario. Con 2 coincidencias sueltas —el modo
      // laxo resuelve nombres de pila— una respuesta de 2018 calzaba contra una
      // cohorte de 2026 por dos "Ana" y un "Juan", y el informe mostraba tres
      // grupos parciales que no tenían nada que ver. Medirlo contra la lista
      // del formulario fue el primer intento y era peor: descartaba grupos
      // buenos cuyo dirigente listó gente de más.
      if (hits < Math.max(3, Math.ceil(cursando.length * 0.6))) continue
      parciales.push(c)
    }
  }

  const listos = [...mejor.values()].sort((a, b) => a.grupo.name.localeCompare(b.grupo.name))
  console.log(`\n${'='.repeat(78)}\nCIERRAN COMPLETO: ${listos.length}\n${'='.repeat(78)}`)
  for (const c of listos) {
    console.log(`  ${(planPorId.get(c.grupo.plan_id ?? '') ?? '?').padEnd(6)} ${c.grupo.name}`)
    console.log(`         resp ${c.resp} · ${c.hits - c.repro} aprobados${c.repro ? ` · ${c.repro} reprobados` : ''}`)
  }

  const cubiertos = new Set(listos.map(c => c.grupo.id))
  const pp = new Map<string, Cand>()
  for (const c of parciales) {
    if (cubiertos.has(c.grupo.id)) continue
    const prev = pp.get(c.grupo.id)
    if (!prev || c.hits > prev.hits) pp.set(c.grupo.id, c)
  }
  const incompletos = [...pp.values()].sort((a, b) => a.faltan.length - b.faltan.length)
  console.log(`\n${'='.repeat(78)}\nCON GENTE SIN EXPLICAR: ${incompletos.length}\n${'='.repeat(78)}`)
  for (const c of incompletos) {
    console.log(`  ${c.grupo.name}  (resp ${c.resp}, ${c.hits}/${c.total})`)
    console.log(`      en el sistema sin explicar (${c.faltan.length}): ${c.faltan.join(' · ')}`)
    if (c.sobran.length) console.log(`      en el form sin calzar    (${c.sobran.length}): ${c.sobran.join(' · ')}`)
  }
  console.log(`\ngrupos abiertos sin ninguna respuesta que los respalde: ${abiertos.length - listos.length - incompletos.length}`)
}

main().catch(e => { console.error(e); process.exit(1) })
