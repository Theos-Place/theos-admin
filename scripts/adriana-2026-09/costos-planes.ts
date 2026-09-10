import { createAdminClient } from '../../src/lib/supabase/admin'
async function main() {
  const sb = createAdminClient()
  const { data } = await sb.from('study_plans').select('id, code, name, cost, currency, is_active').order('cost')
  const filas = (data ?? []) as Record<string, unknown>[]
  console.log('planes:', filas.length)
  const porCosto = new Map<string, string[]>()
  for (const p of filas) {
    const k = `${p.currency ?? 'CRC'} ${p.cost}`
    porCosto.set(k, [...(porCosto.get(k) ?? []), `${p.code ?? '?'} ${p.name}${p.is_active ? '' : ' (inactivo)'}`])
  }
  for (const [costo, planes] of [...porCosto.entries()].sort()) {
    console.log(`\n══ ${costo} → ${planes.length} planes`)
    for (const p of planes.slice(0, 12)) console.log(`     ${p}`)
    if (planes.length > 12) console.log(`     … y ${planes.length - 12} más`)
  }
  // ¿Y los grupos ABIERTOS, que son a los que se puede mover?
  const { data: gs } = await sb.from('study_groups')
    .select('id, name, plan_id, status').in('status', ['en_matricula', 'en_curso'])
  const planes = new Map((filas).map(p => [p.id as string, p]))
  const costos = new Map<string, number>()
  for (const g of (gs ?? []) as {plan_id:string|null}[]) {
    const p = g.plan_id ? planes.get(g.plan_id) : null
    const k = p ? `${p.currency ?? 'CRC'} ${p.cost}` : 'sin plan'
    costos.set(k, (costos.get(k) ?? 0) + 1)
  }
  console.log('\n══ grupos ABIERTOS por costo del plan')
  for (const [k, n] of [...costos.entries()].sort((a,b)=>b[1]-a[1])) console.log(`   ${k.padEnd(14)} → ${n} grupos`)
}
main().catch(e => { console.error(e); process.exit(1) })
