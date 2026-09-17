/**
 * Prueba de humo del enganche servidores → dirigentes.
 *
 * Se elige a alguien que YA está activo en el comité y YA está activo como
 * dirigente: reasignarlo a su mismo puesto es idempotente, así que si algo
 * cambia es que el enganche está mal. No se puede hacer en transacción porque
 * estas funciones van por PostgREST y el rollback no las alcanza.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { assignVolunteer } from '@/lib/supabase/queries/servers'
import { getActiveDirigentes } from '@/lib/supabase/queries/studies'

async function main() {
  const sb = createAdminClient()
  const { data: area } = await sb.from('areas').select('id').eq('name', 'Comité Dirigentes').maybeSingle()
  const areaId = (area as { id: string }).id
  const { data: pos } = await sb.from('service_positions').select('id, title').eq('area_id', areaId)
  const cr = (pos as Array<{ id: string; title: string }>).find(p => p.title === 'Dirigente CR')!

  const { data: vols } = await sb.from('volunteers').select('member_id').eq('position_id', cr.id).eq('status', 'active').limit(5)
  const candidatos = (vols ?? []) as Array<{ member_id: string }>
  const { data: sl } = await sb.from('study_leaders').select('member_id, is_active, availability_status')
    .in('member_id', candidatos.map(v => v.member_id))
  const activo = ((sl ?? []) as Array<{ member_id: string; is_active: boolean; availability_status: string }>)
    .find(x => x.is_active && x.availability_status === 'available')
  if (!activo) throw new Error('no encontré un caso idempotente para probar')

  const antes = {
    dirigentes: (await getActiveDirigentes()).length,
    ficha: activo,
    rol: ((await sb.from('member_roles').select('is_active').eq('member_id', activo.member_id).eq('role', 'dirigente').maybeSingle()).data),
  }
  console.log('ANTES:  ' + JSON.stringify(antes))

  await assignVolunteer(cr.id, activo.member_id)

  const despues = {
    dirigentes: (await getActiveDirigentes()).length,
    ficha: ((await sb.from('study_leaders').select('member_id, is_active, availability_status').eq('member_id', activo.member_id).maybeSingle()).data),
    rol: ((await sb.from('member_roles').select('is_active').eq('member_id', activo.member_id).eq('role', 'dirigente').maybeSingle()).data),
  }
  console.log('DESPUÉS: ' + JSON.stringify(despues))
  console.log(JSON.stringify(antes) === JSON.stringify(despues)
    ? '\n>>> idempotente: el enganche corrió y no cambió nada'
    : '\n>>> ALGO CAMBIÓ, revisar')
}
main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1) })
