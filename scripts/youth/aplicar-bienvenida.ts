/**
 * Le aplica el rol de eventos a quienes YA tienen el puesto "Bienvenida" en el
 * Comité Youth (decisión del usuario 2026-09-18).
 *
 * Hace falta un script porque `position-role-sync` corre al ASIGNAR un puesto,
 * no al cambiar la regla: las 3 personas que ya lo tenían no lo reciben solas.
 *
 * Usa `syncRolesOnAssign`, la misma función de la pantalla de servidores, para
 * que el rol quede con origen 'automatico' y su respaldo en el puesto — si
 * mañana alguien sale del puesto, el rol se le cae solo. Escribirlo a mano
 * dejaría un rol manual que nadie volvería a quitar.
 *
 * Dry-run por defecto; --aplicar escribe.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { syncRolesOnAssign } from '@/lib/supabase/queries/position-role-sync'
import { rolesGrantedByPosition } from '@/lib/servers/position-roles'

const APLICAR = process.argv.includes('--aplicar')
const PUESTO = 'd63e5a38-cef8-4937-81cf-bd03135fc9aa' // Bienvenida · Comité Youth
const ACTOR = 'ti@theosplace.org'

async function main() {
  const sb = createAdminClient()

  // GUARDA: que el puesto sea el que creemos y que la regla lo reconozca.
  const { data: p } = await sb.from('service_positions')
    .select('title, area_id, areas!service_positions_area_id_fkey(name, area_type, parent_id)')
    .eq('id', PUESTO).maybeSingle()
  const puesto = p as { title: string; areas: { name: string; area_type: string } } | null
  if (!puesto) throw new Error('GUARDA: no existe ese puesto')
  const roles = rolesGrantedByPosition({
    title: puesto.title, areaName: puesto.areas.name,
    areaType: puesto.areas.area_type as 'committee', parentAreaName: null,
  })
  console.log(`puesto: "${puesto.title}" en "${puesto.areas.name}"`)
  console.log(`la regla le da: ${roles.length ? roles.join(', ') : '‼ NADA'}`)
  if (!roles.includes('encargado_eventos')) throw new Error('GUARDA: la regla no otorga eventos — no se aplica')

  const { data: v } = await sb.from('volunteers')
    .select('member_id, members!volunteers_member_id_fkey(first_name, last_name)')
    .eq('position_id', PUESTO).eq('status', 'active')
  const gente = (v ?? []) as Array<{ member_id: string; members: { first_name: string; last_name: string } }>
  console.log(`\npersonas activas en el puesto: ${gente.length}`)

  const { data: au } = await sb.from('members').select('auth_user_id').eq('email', ACTOR).maybeSingle()
  const actor = (au as { auth_user_id: string } | null)?.auth_user_id ?? undefined

  for (const g of gente) {
    const nombre = `${g.members.first_name} ${g.members.last_name}`
    const { data: antes } = await sb.from('member_roles').select('is_active, origen')
      .eq('member_id', g.member_id).eq('role', 'encargado_eventos').maybeSingle()
    const tenia = (antes as { is_active: boolean } | null)?.is_active ?? false
    if (!APLICAR) { console.log(`  ${nombre.padEnd(30)} ${tenia ? 'ya lo tiene' : '→ se le daría'}`); continue }
    await syncRolesOnAssign(g.member_id, PUESTO, actor)
    const { data: post } = await sb.from('member_roles').select('is_active, origen')
      .eq('member_id', g.member_id).eq('role', 'encargado_eventos').maybeSingle()
    const r = post as { is_active: boolean; origen: string } | null
    console.log(`  ${nombre.padEnd(30)} ${r?.is_active ? `✓ ${r.origen}` : '‼ no quedó'}`)
  }
  if (!APLICAR) console.log('\n>>> DRY-RUN: no se escribió nada')
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
