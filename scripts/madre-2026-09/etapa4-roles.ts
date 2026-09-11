/**
 * ETAPA 4 · Sincronizar los roles automáticos con las asignaciones reales.
 *   NODE_OPTIONS="--conditions=react-server" npx tsx --env-file=.env.local scripts/madre-2026-09/etapa4-roles.ts
 *   ... --aplicar
 *
 * Las Etapas 2 y 3 escribieron directo en la base, y el sync de roles vive en
 * la app (no hay trigger en volunteers), así que los roles quedaron atrasados.
 * Acá se recalcula todo contra POSITION_ROLE_RULES y se muestra el diff.
 */
import { rolesGrantedByPosition } from '@/lib/servers/position-roles'
import { createAdminClient } from '@/lib/supabase/admin'
import type { RoleId } from '@/types/auth'

const APLICAR = process.argv.includes('--aplicar')

async function todas<T>(tabla: string, cols: string): Promise<T[]> {
  const sb = createAdminClient(); const out: T[] = []
  for (let d = 0; ; d += 1000) {
    const { data, error } = await sb.from(tabla).select(cols).range(d, d + 999)
    if (error) throw error
    out.push(...(data as T[])); if ((data ?? []).length < 1000) break
  }
  return out
}

async function main() {
  const sb = createAdminClient()
  const areas = await todas<any>('areas', 'id, name, area_type, parent_id')
  const A = new Map(areas.map(a => [a.id, a]))
  const pos = await todas<any>('service_positions', 'id, title, area_id, is_active')
  const P = new Map(pos.map(p => [p.id, p]))
  const vol = await todas<any>('volunteers', 'member_id, position_id, status')
  const grants = await todas<any>('member_role_position_grants', 'member_id, role, position_id')

  const rolesDe = (p: any): RoleId[] => {
    const a = A.get(p.area_id); if (!a || a.name.startsWith('[prueba]')) return []
    return rolesGrantedByPosition({ title: p.title, areaName: a.name, areaType: a.area_type,
      parentAreaName: a.parent_id ? (A.get(a.parent_id)?.name ?? null) : null })
  }
  // DEBE ser: por cada asignación ACTIVA, los roles de su puesto.
  const debe = new Set<string>()
  for (const v of vol) {
    if (v.status !== 'active') continue
    const p = P.get(v.position_id); if (!p || !p.is_active) continue
    for (const r of rolesDe(p)) debe.add(`${v.member_id}|${r}|${v.position_id}`)
  }
  const hay = new Set(grants.map(g => `${g.member_id}|${g.role}|${g.position_id}`))
  const otorgar = [...debe].filter(k => !hay.has(k))
  const revocar = [...grants].filter(g => !debe.has(`${g.member_id}|${g.role}|${g.position_id}`))

  const nombre = new Map((await todas<any>('members', 'id, first_name, last_name'))
    .map(m => [m.id, `${m.first_name} ${m.last_name}`.trim()]))
  const resumen = (arr: string[]) => { const m = new Map<string, number>()
    for (const k of arr) { const r = k.split('|')[1]; m.set(r, (m.get(r) ?? 0) + 1) }; return Object.fromEntries(m) }

  console.log('══ ETAPA 4 · DIFF DE ROLES POR PUESTO\n')
  console.log(`  grants que existen hoy:      ${grants.length}`)
  console.log(`  grants que deberían existir: ${debe.size}`)
  console.log(`\n  A OTORGAR: ${otorgar.length}`, resumen(otorgar))
  console.log(`  A REVOCAR: ${revocar.length}`, resumen(revocar.map(g => `${g.member_id}|${g.role}|${g.position_id}`)))

  // Lo que de verdad importa: quién GANA o PIERDE un rol del todo.
  const rolesActuales = new Map<string, Set<string>>()
  for (const g of grants) { const s = rolesActuales.get(g.member_id) ?? new Set(); s.add(g.role); rolesActuales.set(g.member_id, s) }
  const rolesFinales = new Map<string, Set<string>>()
  for (const k of debe) { const [m, r] = k.split('|'); const s = rolesFinales.get(m) ?? new Set(); s.add(r); rolesFinales.set(m, s) }
  const gana: string[] = [], pierde: string[] = []
  for (const [m, s] of rolesFinales) for (const r of s) if (!rolesActuales.get(m)?.has(r)) gana.push(`${nombre.get(m) ?? m}|${r}`)
  for (const [m, s] of rolesActuales) for (const r of s) if (!rolesFinales.get(m)?.has(r)) pierde.push(`${nombre.get(m) ?? m}|${r}`)
  console.log(`\n  PERSONAS QUE GANAN un rol que no tenían: ${gana.length}`, resumen(gana))
  console.log(`  PERSONAS QUE PIERDEN un rol por completo: ${pierde.length}`, resumen(pierde))
  console.log('\n── PIERDEN (todos):')
  pierde.sort().forEach(x => console.log(`   ${x.split('|')[0].padEnd(32)} ${x.split('|')[1]}`))
  console.log('\n── GANAN lider_comite:')
  gana.filter(x => x.endsWith('lider_comite')).sort().forEach(x => console.log(`   ${x.split('|')[0]}`))
  console.log(`\n── GANAN encargado_eventos: ${gana.filter(x => x.endsWith('encargado_eventos')).length} personas`)
  console.log(`── GANAN solicitudes_estudio: ${gana.filter(x => x.endsWith('solicitudes_estudio')).length} personas`)

  if (!APLICAR) { console.log('\n🔎 DRY RUN — no se escribió nada.'); return }
  let o = 0, v2 = 0
  for (const k of otorgar) { const [m, r, p] = k.split('|')
    const { error } = await sb.rpc('grant_position_role', { p_member_id: m, p_role: r, p_position_id: p })
    if (error) throw error; o++ }
  for (const g of revocar) {
    const { error } = await sb.rpc('revoke_position_role', { p_member_id: g.member_id, p_role: g.role, p_position_id: g.position_id })
    if (error) throw error; v2++ }
  console.log(`\n✅ APLICADO — otorgados: ${o}   revocados: ${v2}`)
}
main().catch(e => { console.error(e); process.exit(1) })
