/** ¿Cada charla tiene su comité organizador? Sin él, nadie califica como
 *  servidor (y antes del arreglo de SRV-1, calificaba cualquiera). */
import { createAdminClient } from '../../src/lib/supabase/admin'
async function main() {
  const sb = createAdminClient()
  const { data: ev } = await sb.from('events')
    .select('id, title, starts_at, sede_id, is_recurring')
    .ilike('title', 'Charla%').gte('starts_at', '2026-09-01').order('title')
  const { data: areas } = await sb.from('areas').select('id, name')
  const nombreArea = new Map((areas ?? []).map(a => [(a as {id:string}).id, (a as {name:string}).name]))
  const { data: sedes } = await sb.from('sedes').select('id, name, code')
  const nombreSede = new Map((sedes ?? []).map(s => [(s as {id:string}).id, (s as {name:string}).name]))

  let sinComite = 0
  console.log(`charlas desde el 1 de setiembre: ${(ev ?? []).length}\n`)
  for (const e of (ev ?? []) as Record<string,unknown>[]) {
    const { data: oc } = await sb.from('event_organizing_committees')
      .select('committee_id').eq('event_id', e.id as string)
    const comites = (oc ?? []).map(c => nombreArea.get((c as {committee_id:string}).committee_id) ?? '?')
    const marca = comites.length ? '  ' : '⚠️'
    if (!comites.length) sinComite++
    console.log(`${marca} ${String(e.title).padEnd(34)} | sede: ${(e.sede_id ? nombreSede.get(e.sede_id as string) : '—') ?? '—'} | comités: ${comites.join(', ') || 'NINGUNO'}`)
  }
  console.log(`\n${sinComite} charlas sin comité organizador`)
  console.log('\ncomités de sede disponibles:')
  for (const a of (areas ?? []) as {id:string;name:string}[]) {
    if (/^Sede /.test(a.name)) console.log('   ', a.name, '|', a.id)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
