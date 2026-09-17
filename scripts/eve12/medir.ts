/** EVE-12 etapa 2 · ¿A quién le cambia la vida encender el alcance por comité? */
import { createAdminClient } from '@/lib/supabase/admin'

async function main() {
  const sb = createAdminClient()
  // 1. Eventos vigentes y sus comités
  const DESDE = new Date(Date.now() - 90 * 86400000).toISOString()
  const { data: ev } = await sb.from('events')
    .select('id, title, event_type, starts_at').gte('starts_at', DESDE)
  const eventos = (ev ?? []) as Array<{ id: string; title: string; event_type: string; starts_at: string }>
  const { data: oc } = await sb.from('event_organizing_committees').select('event_id, committee_id')
  const porEvento = new Map<string, string[]>()
  for (const r of (oc ?? []) as Array<{ event_id: string; committee_id: string }>) {
    const a = porEvento.get(r.event_id) ?? []; a.push(r.committee_id); porEvento.set(r.event_id, a)
  }
  const sinComite = eventos.filter(e => !porEvento.has(e.id))
  console.log(`eventos últimos 90 días: ${eventos.length}  ·  SIN comité: ${sinComite.length}`)
  const porTipo = new Map<string, { total: number; sin: number }>()
  for (const e of eventos) {
    const t = porTipo.get(e.event_type) ?? { total: 0, sin: 0 }
    t.total++; if (!porEvento.has(e.id)) t.sin++
    porTipo.set(e.event_type, t)
  }
  console.log('\npor tipo (total · sin comité):')
  ;[...porTipo].sort((a,b)=>b[1].total-a[1].total).forEach(([k,v]) =>
    console.log(`  ${k.padEnd(14)} ${String(v.total).padStart(4)} · ${v.sin}${v.sin ? '  ‼' : ''}`))
  if (sinComite.length) {
    const t = new Map<string, number>()
    for (const e of sinComite) t.set(e.title, (t.get(e.title) ?? 0) + 1)
    console.log('\n  los que quedan sin comité:')
    ;[...t].sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(`     ${String(v).padStart(3)}×  ${k}`))
  }

  // 2. Quién tiene encargado_eventos y con qué origen
  const { data: mr } = await sb.from('member_roles')
    .select('member_id, origen, member:members!member_roles_member_id_fkey(first_name, last_name)')
    .eq('role', 'encargado_eventos').eq('is_active', true)
  const roles = (mr ?? []) as Array<{ member_id: string; origen: string; member: { first_name: string; last_name: string } | null }>
  const auto = roles.filter(r => r.origen === 'automatico')
  const manual = roles.filter(r => r.origen !== 'automatico')
  console.log(`\nencargado_eventos activos: ${roles.length}  ·  automático ${auto.length}  ·  manual ${manual.length}`)
  console.log('  manuales (siguen viendo TODO):')
  manual.forEach(r => console.log(`     ${r.member?.first_name} ${r.member?.last_name}`))

  // 3. Para cada automático: comités de sus puestos activos y cuántos eventos alcanza
  // El embed service_positions→areas es AMBIGUO (hay más de una FK), así que
  // se resuelve en tres consultas en vez de una anidada.
  const { data: vol } = await sb.from('volunteers')
    .select('member_id, position_id').eq('status', 'active').in('member_id', auto.map(r => r.member_id))
  const filas = (vol ?? []) as Array<{ member_id: string; position_id: string }>
  const { data: pos } = await sb.from('service_positions')
    .select('id, area_id').in('id', [...new Set(filas.map(f => f.position_id))])
  const areaDePuesto = new Map(((pos ?? []) as Array<{ id: string; area_id: string }>).map(p => [p.id, p.area_id]))
  const { data: ar } = await sb.from('areas')
    .select('id, name, area_type').in('id', [...new Set([...areaDePuesto.values()])])
  const area = new Map(((ar ?? []) as Array<{ id: string; name: string; area_type: string }>).map(a => [a.id, a]))
  const comitesDe = new Map<string, Set<string>>()
  const nombresDe = new Map<string, Set<string>>()
  for (const f of filas) {
    const aid = areaDePuesto.get(f.position_id)
    if (!aid || area.get(aid)?.area_type !== 'committee') continue
    if (!comitesDe.has(f.member_id)) { comitesDe.set(f.member_id, new Set()); nombresDe.set(f.member_id, new Set()) }
    comitesDe.get(f.member_id)!.add(aid)
    nombresDe.get(f.member_id)!.add(area.get(aid)!.name)
  }
  let sinNingunComite = 0
  const distrib = new Map<number, number>()
  const porComite = new Map<string, number>()
  for (const r of auto) {
    const cs = comitesDe.get(r.member_id) ?? new Set<string>()
    if (!cs.size) { sinNingunComite++; continue }
    const alcanza = eventos.filter(e => (porEvento.get(e.id) ?? []).some(c => cs.has(c))).length
    distrib.set(alcanza, (distrib.get(alcanza) ?? 0) + 1)
    for (const n of nombresDe.get(r.member_id)!) porComite.set(n, (porComite.get(n) ?? 0) + 1)
  }
  console.log(`\nautomáticos SIN ningún comité activo → perderían todo: ${sinNingunComite}`)
  console.log('cuántos eventos alcanzaría cada uno (eventos → personas):')
  ;[...distrib].sort((a,b)=>a[0]-b[0]).forEach(([k,v]) => console.log(`  ${String(k).padStart(3)} eventos → ${v} personas`))
  console.log('\ncomités de esas personas:')
  ;[...porComite].sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(`  ${String(v).padStart(3)}  ${k}`))
}
main().catch(e => { console.error('ERROR:', e); process.exit(1) })
