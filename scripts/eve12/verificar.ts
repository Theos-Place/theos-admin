/**
 * EVE-12 etapa 2 · La regla, corrida contra gente y eventos REALES.
 * No prueba el HTTP: prueba que los datos que el guard va a leer producen la
 * decisión esperada para personas concretas.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { alcanceDeEventos, puedeOperarEvento } from '@/lib/auth/alcance-de-eventos'
import { datosDeAlcanceDeEventos } from '@/lib/supabase/queries/events'
import { withBaseRole } from '@/lib/auth/roles'
import type { RoleId } from '@/types/auth'

async function main() {
  const sb = createAdminClient()
  const { data: ev } = await sb.from('events')
    .select('id, title, starts_at').eq('event_type', 'charla')
    .gte('starts_at', new Date(Date.now() - 30 * 86400000).toISOString()).limit(400)
  const eventos = (ev ?? []) as Array<{ id: string; title: string }>
  const { data: oc } = await sb.from('event_organizing_committees').select('event_id, committee_id')
  const comitesDe = new Map<string, string[]>()
  for (const r of (oc ?? []) as Array<{ event_id: string; committee_id: string }>) {
    const a = comitesDe.get(r.event_id) ?? []; a.push(r.committee_id); comitesDe.set(r.event_id, a)
  }

  // Tres personas: una automática de sede, una del Comité Youth y una manual.
  const { data: mr } = await sb.from('member_roles')
    .select('member_id, origen, member:members!member_roles_member_id_fkey(first_name, last_name)')
    .eq('role', 'encargado_eventos').eq('is_active', true)
  const filas = (mr ?? []) as Array<{ member_id: string; origen: string; member: { first_name: string; last_name: string } | null }>

  const { data: areas } = await sb.from('areas').select('id, name').eq('area_type', 'committee')
  const nombre = new Map(((areas ?? []) as Array<{ id: string; name: string }>).map(a => [a.id, a.name]))

  const muestra = [
    ...filas.filter(f => f.origen === 'automatico').slice(0, 4),
    ...filas.filter(f => f.origen !== 'automatico').slice(0, 2),
  ]
  for (const f of muestra) {
    const { data: roleRows } = await sb.from('member_roles')
      .select('role').eq('member_id', f.member_id).eq('is_active', true)
    const roles = withBaseRole(((roleRows ?? []) as Array<{ role: RoleId }>).map(r => r.role))
    const datos = await datosDeAlcanceDeEventos(f.member_id)
    const a = alcanceDeEventos({ roles, rolesAutomaticos: datos.rolesAutomaticos as RoleId[], comitesDeSusPuestos: datos.comitesDeSusPuestos })
    const puede = eventos.filter(e => puedeOperarEvento(a, comitesDe.get(e.id) ?? []))
    const titulos = [...new Set(puede.map(e => e.title))]
    console.log(`\n${f.member?.first_name} ${f.member?.last_name}  ·  rol ${f.origen}`)
    console.log(`  alcance: ${a.alcance}${a.alcance === 'comites' ? ` (${a.comites.map(c => nombre.get(c) ?? c).join(', ')})` : ''}`)
    console.log(`  opera ${puede.length} de ${eventos.length} charlas del último mes`)
    console.log(`  cuáles: ${titulos.join(' · ') || '(ninguna)'}`)
  }
}
main().catch(e => { console.error('ERROR:', e); process.exit(1) })
