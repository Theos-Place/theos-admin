/**
 * EVE-12 · Crea los tres comités Youth y le asigna comité organizador a cada
 * charla (2026-09-17).
 *
 * POR QUÉ. El alcance por comité necesita que cada evento diga de quién es, y
 * hoy 174 de 188 charlas no tienen comité organizador. Con la regla encendida,
 * los 184 encargados automáticos —que son los de las sedes— perderían el
 * check-in semanal de casi todas.
 *
 * El mapeo sale del TÍTULO, con la regla de lib/events/comite-de-la-charla.ts:
 * nombre exacto, después plural ("Sede Pedregal DomingoS"), y de último sin el
 * día pero SOLO si queda un candidato. Esa última condición es la que evita el
 * error que tuvo el primer intento: Pedregal tiene tres comités y sin ella las
 * charlas del domingo caían en el del miércoles.
 *
 * Los comités Youth se crean porque no existían: decisión del usuario de
 * tenerlos aparte y no colgados de la sede.
 *
 * Con --aplicar escribe; sin la bandera hace dry-run y no toca nada.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { canonicalCharlaTitle } from '@/lib/sedes-canonical'
import { comiteDeLaCharla, type Comite } from '@/lib/events/comite-de-la-charla'

const APLICAR = process.argv.includes('--aplicar')
/** Crear los comités SIN tocar las asignaciones: son dos decisiones separadas y
 *  la segunda se aprueba viendo la lista. */
const SOLO_COMITES = process.argv.includes('--solo-comites')
const YOUTH = ['Sede Pedregal Domingo Youth', 'Sede Pedregal Miércoles Youth', 'Sede Cartago Youth']
/** Solo lo vigente: no tiene sentido etiquetar 3.400 charlas históricas. */
const DESDE = new Date(Date.now() - 90 * 86400000).toISOString()

async function main() {
  const sb = createAdminClient()
  const { data: padre } = await sb.from('areas').select('id').eq('name', 'Sedes').maybeSingle()
  const parentId = (padre as { id: string } | null)?.id ?? null
  if (!parentId) throw new Error('GUARDA: no encuentro el área padre "Sedes"')

  // ── 1. Los tres comités Youth ──────────────────────────────────────────
  const { data: existentes } = await sb.from('areas').select('id, name').eq('area_type', 'committee')
  const yaEstan = new Map(((existentes ?? []) as Comite[]).map(a => [a.name, a]))
  const crear = YOUTH.filter(n => !yaEstan.has(n))
  console.log(`=== 1. comités Youth ===`)
  for (const n of YOUTH) console.log(`  ${n}  ${yaEstan.has(n) ? '(ya existe)' : '→ CREAR'}`)
  if ((APLICAR || SOLO_COMITES) && crear.length) {
    const { data, error } = await sb.from('areas')
      .insert(crear.map(name => ({ name, area_type: 'committee', parent_id: parentId, is_active: true })))
      .select('id, name')
    if (error) throw error
    for (const a of (data ?? []) as Comite[]) yaEstan.set(a.name, a)
    console.log(`  creados: ${crear.length}`)
  }

  // ── 2. El mapeo ────────────────────────────────────────────────────────
  const comites = [...yaEstan.values()]
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
    // Los Youth recién creados pueden no estar si esto es un dry-run.
    const c = comiteDeLaCharla(canon, comites) ?? (YOUTH.includes(`Sede ${canon.replace(/^Charla /, '')}`)
      ? { id: '(por crear)', name: `Sede ${canon.replace(/^Charla /, '')}` } : null)
    if (!c) { sinResolver.set(e.title, (sinResolver.get(e.title) ?? 0) + 1); continue }
    resumen.set(c.name, (resumen.get(c.name) ?? 0) + 1)
    if (c.id !== '(por crear)') asignar.push({ event_id: e.id, committee_id: c.id })
  }

  console.log(`\n=== 2. charlas sin comité a asignar (${(ev ?? []).length} revisadas) ===`)
  ;[...resumen].sort((a, b) => b[1] - a[1]).forEach(([n, k]) => console.log(`  ${String(k).padStart(3)}×  → ${n}`))
  if (sinResolver.size) {
    console.log(`\n  ‼ sin resolver (${[...sinResolver.values()].reduce((a, b) => a + b, 0)}):`)
    ;[...sinResolver].forEach(([t, k]) => console.log(`     ${k}×  ${t}`))
  } else console.log('\n  sin resolver: ninguna')

  if (SOLO_COMITES) { console.log('\n>>> comités creados; las asignaciones quedan pendientes de aprobación'); return }
  if (!APLICAR) { console.log('\n>>> DRY-RUN: no se escribió nada'); return }
  if (asignar.length) {
    const { error } = await sb.from('event_organizing_committees').insert(asignar)
    if (error) throw error
  }
  console.log(`\n>>> APLICADO: ${asignar.length} asignaciones`)
}
main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1) })
