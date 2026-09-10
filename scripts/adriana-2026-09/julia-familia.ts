import { createAdminClient } from '../../src/lib/supabase/admin'
const JULIA = '9f228e37-37ec-4fce-8e6b-9c3079055fb4'
const NATALIA = '20b02cef-123d-4102-a5ab-4da25f105d95'
const FAM = 'cae4d600-9165-4a2f-80bf-5400806fd6bb'
async function main() {
  const sb = createAdminClient()
  console.log('══ quiénes están en la familia de Julia')
  const { data: fm } = await sb.from('family_members').select('member_id, relation').eq('family_unit_id', FAM)
  for (const f of (fm ?? []) as {member_id:string; relation:string}[]) {
    const { data: m } = await sb.from('members')
      .select('first_name, last_name, birth_date, email, cedula').eq('id', f.member_id).maybeSingle()
    const x = m as Record<string,unknown>
    console.log(`   ${f.relation.padEnd(10)} | ${x.first_name} ${x.last_name} | nace ${x.birth_date ?? '—'} | ${x.email ?? 'sin correo'} | ced ${x.cedula ?? '—'} | ${f.member_id}`)
  }
  console.log('\n══ Natalia: ¿está en alguna familia?')
  const { data: fn } = await sb.from('family_members').select('family_unit_id, relation').eq('member_id', NATALIA)
  console.log('   ', JSON.stringify(fn))
  console.log('\n══ los 70 check-ins de Julia: en qué eventos y cuándo')
  const { data: ch } = await sb.from('event_checkins')
    .select('event_id, checked_in_at, sub_event_id').eq('member_id', JULIA).order('checked_in_at', { ascending: false }).limit(8)
  for (const c of (ch ?? []) as Record<string,unknown>[]) {
    const { data: e } = await sb.from('events').select('title').eq('id', c.event_id as string).maybeSingle()
    console.log(`   ${String(c.checked_in_at).slice(0,10)} | ${(e as {title:string}|null)?.title} | sub-evento: ${c.sub_event_id ? 'sí' : 'no'}`)
  }
  const { data: subs } = await sb.from('event_checkins').select('sub_event_id').eq('member_id', JULIA)
  const conSub = (subs ?? []).filter(s => (s as {sub_event_id:string|null}).sub_event_id).length
  console.log(`\n   de los ${(subs ?? []).length}: ${conSub} en un sub-evento (cuido de niños), ${(subs ?? []).length - conSub} en el evento general`)
  console.log('\n══ ¿Natalia tiene check-ins propios?')
  const { count } = await sb.from('event_checkins').select('id', { count: 'exact', head: true }).eq('member_id', NATALIA)
  console.log('   ', count)
}
main().catch(e => { console.error(e); process.exit(1) })
