/** El conteo real de Sede Madrid, para comprobar lo que reportó Sofía. */
import { createAdminClient } from '../../src/lib/supabase/admin'
async function main() {
  const sb = createAdminClient()
  const { data: areas } = await sb.from('areas').select('id, name').ilike('name', '%Madrid%')
  console.log('áreas que calzan:', JSON.stringify(areas))
  const A = ((areas ?? [])[0] as {id:string; name:string})
  if (!A) throw new Error('no hay área Madrid')
  const { data: pos } = await sb.from('service_positions').select('id, title').eq('area_id', A.id)
  const ids = (pos ?? []).map(p => (p as {id:string}).id)
  const { data: vols } = await sb.from('volunteers').select('member_id, position_id, status').in('position_id', ids)
  const activos = (vols ?? []).filter(v => (v as {status:string}).status === 'active')
  const personas = new Set(activos.map(v => (v as {member_id:string}).member_id))
  console.log(`${A.name}: ${activos.length} puestos ocupados · ${personas.size} personas`)
  console.log(`el encabezado decía "${activos.length} servidores activos"; ahora dice "${personas.size} personas en ${activos.length} puestos"`)
  const cuenta = new Map<string, number>()
  for (const v of activos as {member_id:string}[]) cuenta.set(v.member_id, (cuenta.get(v.member_id) ?? 0) + 1)
  const varios = [...cuenta.entries()].filter(([, n]) => n > 1).sort((a,b)=>b[1]-a[1])
  console.log(`\ncon más de un puesto: ${varios.length} personas`)
  for (const [id, n] of varios.slice(0, 8)) {
    const { data: m } = await sb.from('members').select('first_name, last_name').eq('id', id).maybeSingle()
    console.log(`   ${n} puestos · ${(m as {first_name:string}|null)?.first_name} ${(m as {last_name:string}|null)?.last_name}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
