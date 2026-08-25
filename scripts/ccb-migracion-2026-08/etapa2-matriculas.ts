/**
 * ETAPA 2 · Matricular a los participantes de los 102 grupos abiertos.
 *
 *   dry-run:  npx tsx scripts/ccb-migracion-2026-08/etapa2-matriculas.ts
 *   aplicar:  ... etapa2-matriculas.ts --aplicar
 *
 * DEDUPE por (member_id, group_id) — NUNCA por (member_id, plan_id): una persona
 * puede tener dos matrículas legítimas del mismo plan en grupos distintos
 * (repitió, o se cambió de grupo).
 *
 * Los 'Leader' NO se matriculan: ya sirvieron en la Etapa 1 para resolver
 * dirigente y co-dirigente.
 *
 * Nunca se crean miembros: si el external_id no está en la base, va al reporte.
 */
import { writeFileSync } from 'node:fs'
import { createAdminClient } from '../../src/lib/supabase/admin'
import { leerCsv, norm, esListaAdministrativa, nombreEnLaBase } from './lib'

const APLICAR = process.argv.includes('--aplicar')
const admin = createAdminClient() as unknown as { from: (t: string) => any }

async function todo<T>(tabla: string, select: string): Promise<T[]> {
  const out: T[] = []
  for (let d = 0; ; d += 1000) {
    const { data, error } = await admin.from(tabla).select(select).range(d, d + 999).order('id')
    if (error) throw new Error(`${tabla}: ${error.message}`)
    out.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  return out
}

async function main() {
  console.log(APLICAR ? '⚠️  MODO APLICAR — escribe en la base\n' : '🔍 DRY-RUN — no escribe nada\n')
  const csvGrupos = leerCsv('ccb-grupos-abiertos-2026-08.csv')
  const parts = leerCsv('ccb-participantes-grupos-2026-08.csv')

  const miembros = await todo<any>('members', 'id, external_id, first_name, last_name')
  const porExternal = new Map(miembros.filter(m => m.external_id).map(m => [String(m.external_id).trim(), m]))
  const gruposBd = await todo<any>('study_groups', 'id, name, plan_id')
  const porNombreBd = new Map(gruposBd.map(g => [norm(g.name), g]))
  const enrolls = await todo<any>('study_enrollments', 'id, member_id, group_id')
  const yaExiste = new Set(enrolls.map(e => `${e.member_id}|${e.group_id}`))

  // Los 102 grupos de esta migración: su lista de ids es lo que la Etapa 3 va a
  // EXCLUIR del universo de candidatas (regla de oro). Se guarda a archivo para
  // que la Etapa 3 no tenga que re-deducirla.
  const idsCcb: string[] = []
  for (const g of csvGrupos) {
    const bd = porNombreBd.get(norm(nombreEnLaBase(g.group_name)))
    if (bd) idsCcb.push(bd.id)
  }

  const members = parts.filter(p => p.rol === 'Member')
  const leaders = parts.filter(p => p.rol === 'Leader')

  const nuevas: any[] = []
  let yaEstaban = 0
  const sinPersona: string[] = [], sinGrupo: string[] = [], enListas: string[] = []

  for (const p of members) {
    if (esListaAdministrativa(p.group_name)) { enListas.push(p.group_name); continue }
    const m = porExternal.get(p.external_id)
    if (!m) { sinPersona.push(`${p.external_id} · ${p.name} · ${p.group_name}`); continue }
    const g = porNombreBd.get(norm(nombreEnLaBase(p.group_name)))
    if (!g) { sinGrupo.push(`${p.group_name} (de ${p.name})`); continue }
    if (yaExiste.has(`${m.id}|${g.id}`)) { yaEstaban++; continue }
    nuevas.push({
      member_id: m.id, group_id: g.id, plan_id: g.plan_id, status: 'enrolled',
      _persona: `${m.first_name} ${m.last_name}`, _grupo: g.name,
    })
  }

  console.log('══ RESUMEN ══')
  console.log(`  filas 'Member' en el archivo:  ${members.length}`)
  console.log(`  filas 'Leader' (NO se matriculan): ${leaders.length}`)
  console.log(`  ─────────────────────────────────`)
  console.log(`  matrículas NUEVAS:             ${nuevas.length}`)
  console.log(`  YA EXISTÍAN:                   ${yaEstaban}`)
  console.log(`  sin persona (external_id):     ${sinPersona.length}`)
  console.log(`  sin grupo en la base:          ${sinGrupo.length}`)
  console.log(`  en listas administrativas:     ${enListas.length}`)
  console.log(`  ─────────────────────────────────`)
  console.log(`  suma: ${nuevas.length + yaEstaban + sinPersona.length + sinGrupo.length + enListas.length} de ${members.length}`)
  console.log(`\n  → ${yaEstaban} de ${members.length} ya estaban: esa es la actividad que YA se había migrado.`)

  if (sinPersona.length) {
    console.log(`\n══ SIN PERSONA (${sinPersona.length}) — no se crean miembros ══`)
    for (const s of sinPersona) console.log(`  · ${s}`)
  }
  if (sinGrupo.length) {
    console.log(`\n══ SIN GRUPO (${sinGrupo.length}) ══`)
    for (const s of [...new Set(sinGrupo)]) console.log(`  · ${s}`)
  }

  // Personas con DOS matrículas del mismo plan tras esta corrida: es legítimo
  // (repitió o se cambió), pero conviene verlo porque es lo que haría fallar un
  // dedupe por (persona, plan) — el que NO se usa acá.
  const porPersonaPlan = new Map<string, number>()
  for (const n of nuevas) {
    const k = `${n.member_id}|${n.plan_id}`
    porPersonaPlan.set(k, (porPersonaPlan.get(k) ?? 0) + 1)
  }
  const dobles = [...porPersonaPlan.values()].filter(v => v > 1).length
  console.log(`\n  personas con 2+ matrículas NUEVAS del mismo plan: ${dobles}`)
  console.log(`  (legítimo: grupos distintos. Por eso el dedupe es por grupo, no por plan.)`)

  console.log('\n══ MUESTRA (5) ══')
  for (const n of nuevas.slice(0, 5)) console.log(`  · ${n._persona} → ${n._grupo}`)

  writeFileSync('scripts/ccb-migracion-2026-08/grupos-de-esta-migracion.json',
    JSON.stringify(idsCcb, null, 1))
  console.log(`\n  ids de los ${idsCcb.length} grupos CCB guardados para la Etapa 3`)
  console.log('  (la regla de oro excluye TODAS sus matrículas, no solo las nuevas:')
  console.log('   las que ya estaban también son actuales, no graduaciones viejas)')

  if (!APLICAR) { console.log('\n(dry-run — no se escribió nada)'); return }
  console.log('\n── aplicando ──')
  let ok = 0
  for (let i = 0; i < nuevas.length; i += 200) {
    const lote = nuevas.slice(i, i + 200).map(({ _persona, _grupo, ...r }) => r)
    const { error } = await admin.from('study_enrollments').insert(lote)
    if (error) { console.log(`  ✗ lote ${i}: ${error.message}`); continue }
    ok += lote.length
  }
  console.log(`  matrículas creadas: ${ok}`)
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
