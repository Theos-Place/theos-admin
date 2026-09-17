/** SOLO PRUEBA: pedir el borrado de "Dirigente CR" (218 activos) debe TIRAR. */
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteServicePosition } from '@/lib/supabase/queries/servers'
async function main() {
  const sb = createAdminClient()
  const { data: area } = await sb.from('areas').select('id').eq('name', 'Comité Dirigentes').maybeSingle()
  const { data: pos } = await sb.from('service_positions').select('id, title').eq('area_id', (area as { id: string }).id)
  const cr = (pos as Array<{ id: string; title: string }>).find(p => p.title === 'Dirigente CR')!
  const antes = (await sb.from('volunteers').select('id', { count: 'exact', head: true }).eq('position_id', cr.id)).count
  console.log(`voluntarios en "Dirigente CR" antes: ${antes}`)
  try { await deleteServicePosition(cr.id); console.log('>>> BORRÓ. El guard no funciona.') }
  catch (e) { console.log(`>>> bloqueado: ${e instanceof Error ? e.message : e}`) }
  const despues = (await sb.from('volunteers').select('id', { count: 'exact', head: true }).eq('position_id', cr.id)).count
  const sigue = (await sb.from('service_positions').select('id').eq('id', cr.id).maybeSingle()).data
  console.log(`voluntarios después: ${despues} · el puesto sigue existiendo: ${!!sigue}`)
}
main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1) })
