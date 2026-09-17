/**
 * EVE-12 · Le asigna comité organizador a cada charla (2026-09-17).
 *
 * POR QUÉ. El alcance por comité necesita que cada evento diga de quién es, y
 * hoy 174 de 188 charlas no tienen comité organizador. Con la regla encendida,
 * los 184 encargados automáticos —que son los de las sedes— perderían el
 * check-in semanal de casi todas.
 *
 * El mapeo sale del TÍTULO, con la regla de lib/events/comite-de-la-charla.ts:
 * Youth primero (todas al Comité Youth), después nombre exacto, plural ("Sede
 * Pedregal DomingoS") y de último sin el día pero SOLO si queda un candidato.
 * Esa última condición evita el error del primer intento: Pedregal tiene tres
 * comités y sin ella las charlas del domingo caían en el del miércoles.
 *
 * LIMPIEZA. Este script llegó a crear tres comités Youth aparte (Pedregal
 * Domingo, Pedregal Miércoles y Cartago). Era innecesario: el Comité Youth ya
 * existía con cinco puestos, y las charlas Youth son suyas sin importar la
 * sede. --limpiar borra esos tres, y solo si siguen vacíos.
 *
 * Con --aplicar escribe; sin la bandera hace dry-run y no toca nada.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { canonicalCharlaTitle } from '@/lib/sedes-canonical'
import { comiteDeLaCharla, type Comite } from '@/lib/events/comite-de-la-charla'

const APLICAR = process.argv.includes('--aplicar')
/** Borra los tres comités Youth de más, sin tocar las asignaciones. */
const LIMPIAR = process.argv.includes('--limpiar')
const SOBRAN = ['Sede Pedregal Domingo Youth', 'Sede Pedregal Miércoles Youth', 'Sede Cartago Youth']
/** Solo lo vigente: no tiene sentido etiquetar 3.400 charlas históricas. */
const DESDE = new Date(Date.now() - 90 * 86400000).toISOString()

async function main() {
  const sb = createAdminClient()

  // ── 1. Los comités Youth que sobran ────────────────────────────────────
  const { data: existentes } = await sb.from('areas').select('id, name').eq('area_type', 'committee')
  const todos = (existentes ?? []) as Comite[]
  const aBorrar = todos.filter(a => SOBRAN.includes(a.name))
  if (LIMPIAR || APLICAR) {
    console.log('=== 1. comités Youth de más ===')
    for (const a of aBorrar) {
      // GUARDA: nunca borrar uno que ya tenga gente o charlas colgando.
      const { count: puestos } = await sb.from('service_positions')
        .select('id', { count: 'exact', head: true }).eq('area_id', a.id)
      const { count: charlas } = await sb.from('event_organizing_committees')
        .select('event_id', { count: 'exact', head: true }).eq('committee_id', a.id)
      if (puestos || charlas) { console.log(`  ‼ ${a.name}: puestos=${puestos} charlas=${charlas} → NO se borra`); continue }
      if (LIMPIAR) {
        const { error } = await sb.from('areas').delete().eq('id', a.id)
        if (error) throw error
        console.log(`  ✓ borrado ${a.name}`)
      } else console.log(`  ${a.name} → vacío, se puede borrar`)
    }
    if (!aBorrar.length) console.log('  ninguno (ya limpio)')
  }

  // ── 2. El mapeo ────────────────────────────────────────────────────────
  const borrados = new Set(LIMPIAR ? aBorrar.map(a => a.id) : [])
  const comites = todos.filter(a => !borrados.has(a.id) && !SOBRAN.includes(a.name))
  const { data: ev } = await sb.from('events')
    .select('id, title').eq('event_type', 'charla').gte('starts_at', DESDE)
  const { data: yaCon } = await sb.from('event_organizing_committees').select('event_id')
  const conComite = new Set(((yaCon ?? []) as Array<{ event_id: string }>).map(x => x.event_id))

  const asignar: Array<{ event_id: string; committee_id: string }> = []
  const resumen = new Map<string, number>()
  const sinResolver = new Map<string, number>()
  for (const e of (ev ?? []) as Array<{ id: string; title: string }>) {
    if (conComite.has(e.id)) continue
    const canon = canonicalCharlaTitle(e.title) ?? e.title
    const c = comiteDeLaCharla(canon, comites)
    if (!c) { sinResolver.set(e.title, (sinResolver.get(e.title) ?? 0) + 1); continue }
    resumen.set(c.name, (resumen.get(c.name) ?? 0) + 1)
    asignar.push({ event_id: e.id, committee_id: c.id })
  }

  console.log(`\n=== 2. charlas sin comité a asignar (${(ev ?? []).length} revisadas) ===`)
  ;[...resumen].sort((a, b) => b[1] - a[1]).forEach(([n, k]) => console.log(`  ${String(k).padStart(3)}×  → ${n}`))
  if (sinResolver.size) {
    console.log(`\n  ‼ sin resolver (${[...sinResolver.values()].reduce((a, b) => a + b, 0)}):`)
    ;[...sinResolver].forEach(([t, k]) => console.log(`     ${k}×  ${t}`))
  } else console.log('\n  sin resolver: ninguna')

  if (!APLICAR) { console.log(`\n>>> ${LIMPIAR ? 'LIMPIEZA hecha; las asignaciones quedan' : 'DRY-RUN: no se escribió nada'}`); return }
  if (asignar.length) {
    const { error } = await sb.from('event_organizing_committees').insert(asignar)
    if (error) throw error
  }
  console.log(`\n>>> APLICADO: ${asignar.length} asignaciones`)
}
main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1) })
