import { createAdminClient } from '../../src/lib/supabase/admin'
const CANDIDATAS = ['cartago', 'liberia', 'alajuela', 'potrero', 'perez-zeledon', 'san-rafael-de-alajuela']
async function main() {
  const s = createAdminClient()
  const { data } = await s.from('sedes')
    .select('id, code, name, is_active, is_zone, is_historical, day, time, age_group, location')
    .order('name')
  const filas = (data ?? []) as Record<string, unknown>[]
  console.log('total sedes:', filas.length)
  const f = (b: unknown) => b ? 'sí' : ' —'
  console.log('\ncode                      | activa | zona | histórica | día        | hora  | edad')
  for (const r of filas) {
    const marca = CANDIDATAS.includes(r.code as string) ? '»' : ' '
    console.log(`${marca}${String(r.code).padEnd(25)}|  ${f(r.is_active)}   |  ${f(r.is_zone)} |    ${f(r.is_historical)}     | ${String(r.day ?? '').padEnd(11)}| ${String(r.time ?? '').padEnd(6)}| ${r.age_group ?? ''}`)
  }
  // ¿Alguien las usa hoy como sede de miembro / evento?
  for (const c of CANDIDATAS) {
    const { count: miembros } = await s.from('members').select('id', { count: 'exact', head: true }).eq('sede', c)
    const { data: sede } = await s.from('sedes').select('id').eq('code', c).maybeSingle()
    const sedeId = (sede as { id: string } | null)?.id
    let eventos = 0
    if (sedeId) {
      const { count } = await s.from('events').select('id', { count: 'exact', head: true }).eq('sede_id', sedeId)
      eventos = count ?? 0
    }
    const { count: grupos } = await s.from('study_groups').select('id', { count: 'exact', head: true }).eq('zone', c)
    console.log(`\n${c}: miembros=${miembros ?? 0} eventos=${eventos} grupos(zone)=${grupos ?? 0}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
