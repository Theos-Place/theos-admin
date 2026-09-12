/**
 * Dobles por renombre + impacto en roles, SIMULANDO la baja del grupo (c).
 *   NODE_OPTIONS="--conditions=react-server" npx tsx --env-file=.env.local \
 *     scripts/depuracion-2026-09-12/dobles-y-roles.ts
 */
import { readFileSync } from 'node:fs'
import { createAdminClient } from '@/lib/supabase/admin'
import { rolesGrantedByPosition } from '@/lib/servers/position-roles'
const L = require('../madre-2026-09/lib.cjs')

const clasif = JSON.parse(readFileSync('scripts/depuracion-2026-09-12/clasificacion.json', 'utf8'))
const aBajar = new Set<string>(clasif.c.map((x: any) => x.id))

async function todas<T>(t: string, cols: string): Promise<T[]> {
  const sb = createAdminClient(); const out: T[] = []
  for (let d = 0; ; d += 1000) {
    const { data, error } = await sb.from(t).select(cols).range(d, d + 999)
    if (error) throw error; out.push(...(data as T[])); if ((data ?? []).length < 1000) break
  }
  return out
}

async function main() {
  // ── Tabla viejo → oficial, por comité ────────────────────────────────
  const PE = L.hoja('Personas').filter((r: any) => String(r['Puesto oficial 2026']).trim())
  const corr = L.correccionesDifusas()
  const corrCom = new Map(L.CORRECCIONES_POR_COMITE.map((x: any) => [`${L.norm(x.ccb)}|${L.norm(x.comite)}`, x.oficial]))
  const traduce = new Map<string, Set<string>>()   // norm(viejo) → oficiales
  for (const r of PE) {
    const ccb = L.norm(r['Puesto como está en CCB'])
    const of = corrCom.get(`${ccb}|${L.norm(r['Comité'])}`) ?? corr.get(ccb) ?? String(r['Puesto oficial 2026']).trim()
    if (!traduce.has(ccb)) traduce.set(ccb, new Set())
    traduce.get(ccb)!.add(L.norm(of))
  }

  const areas = await todas<any>('areas', 'id, name, area_type, parent_id')
  const A = new Map(areas.map(a => [a.id, a]))
  const pos = await todas<any>('service_positions', 'id, title, area_id, is_active')
  const P = new Map(pos.map(p => [p.id, p]))
  const vol = await todas<any>('volunteers', 'id, member_id, position_id, status')
  const mem = new Map((await todas<any>('members', 'id, first_name, last_name')).map(m => [m.id, `${m.first_name} ${m.last_name}`.trim()]))

  // Estado DESPUÉS de bajar el grupo (c)
  const activas = vol.filter(v => v.status === 'active' && !aBajar.has(v.id))
    .map(v => ({ ...v, p: P.get(v.position_id) }))
    .filter(v => v.p && v.p.is_active && !A.get(v.p.area_id)?.name.startsWith('[prueba]'))

  // ── Dobles en el MISMO comité ────────────────────────────────────────
  const porMiembroComite = new Map<string, any[]>()
  for (const v of activas) { const k = `${v.member_id}|${v.p.area_id}`; if (!porMiembroComite.has(k)) porMiembroComite.set(k, []); porMiembroComite.get(k)!.push(v) }
  const dobles = [...porMiembroComite.entries()].filter(([, l]) => l.length > 1)
  const cerrar: any[] = [], dejar: any[] = []
  for (const [k, lista] of dobles) {
    const comite = A.get(k.split('|')[1])!.name
    for (const a of lista) for (const b of lista) {
      if (a.id === b.id) continue
      // a es "viejo" si su título traduce al de b
      if (traduce.get(L.norm(a.p.title))?.has(L.norm(b.p.title))) {
        cerrar.push({ vid: a.id, persona: mem.get(a.member_id), comite, viejo: a.p.title, oficial: b.p.title })
      }
    }
    const ids = new Set(cerrar.map(x => x.vid))
    if (!lista.some(x => ids.has(x.id))) dejar.push({ persona: mem.get(lista[0].member_id), comite, puestos: lista.map(x => x.p.title) })
  }
  const cerrarUnicos = [...new Map(cerrar.map(x => [x.vid, x])).values()]
  console.log('══ DOBLES EN EL MISMO COMITÉ (después de bajar el grupo c)\n')
  console.log(`  personas con 2+ puestos en un mismo comité: ${dobles.length}`)
  console.log(`  pares "viejo + su reemplazo oficial" → se cierra el viejo: ${cerrarUnicos.length}`)
  console.log(`  casos de puestos genuinamente distintos → se quedan los dos: ${dejar.length}`)
  console.log('\n── SE CERRARÍAN (por puesto viejo):')
  const u = new Map<string, number>()
  for (const x of cerrarUnicos) { const k = `${x.comite}|${x.viejo} → ${x.oficial}`; u.set(k, (u.get(k) ?? 0) + 1) }
  ;[...u].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`   ${String(n).padStart(3)}  ${k.split('|')[0].padEnd(28)} ${k.split('|')[1]}`))
  console.log('\n── SE QUEDAN LOS DOS (muestra de 15):')
  dejar.slice(0, 15).forEach(x => console.log(`   ${String(x.persona).padEnd(30)} ${x.comite.padEnd(26)} ${x.puestos.map((t: string) => `«${t}»`).join(' + ')}`))

  // ── Roles ────────────────────────────────────────────────────────────
  const rolesDe = (p: any) => { const a = A.get(p.area_id); if (!a || a.name.startsWith('[prueba]')) return []
    return rolesGrantedByPosition({ title: p.title, areaName: a.name, areaType: a.area_type, parentAreaName: a.parent_id ? (A.get(a.parent_id)?.name ?? null) : null }) }
  const cerrarSet = new Set(cerrarUnicos.map(x => x.vid))
  const finales = activas.filter(v => !cerrarSet.has(v.id))
  const rolFinal = new Map<string, Set<string>>()
  for (const v of finales) for (const r of rolesDe(v.p)) { const s = rolFinal.get(v.member_id) ?? new Set(); s.add(r); rolFinal.set(v.member_id, s) }
  const grants = await todas<any>('member_role_position_grants', 'member_id, role, position_id')
  const rolHoy = new Map<string, Set<string>>()
  for (const g of grants) { const s = rolHoy.get(g.member_id) ?? new Set(); s.add(g.role); rolHoy.set(g.member_id, s) }
  const pierden: string[] = []
  for (const [m, s] of rolHoy) for (const r of s) if (!rolFinal.get(m)?.has(r)) pierden.push(`${mem.get(m) ?? m}|${r}`)
  const cnt = (a: string[]) => { const m = new Map<string, number>(); for (const x of a) { const r = x.split('|')[1]; m.set(r, (m.get(r) ?? 0) + 1) } return Object.fromEntries(m) }
  console.log(`\n══ ROLES QUE SE PERDERÍAN: ${pierden.length}`, cnt(pierden))
  console.log('\n── lider_comite (todos):')
  pierden.filter(x => x.endsWith('lider_comite')).sort().forEach(x => console.log(`   ${x.split('|')[0]}`))
  console.log('\n── solicitudes_estudio (todos):')
  pierden.filter(x => x.endsWith('solicitudes_estudio')).sort().forEach(x => console.log(`   ${x.split('|')[0]}`))
  console.log(`\n── encargado_eventos: ${pierden.filter(x => x.endsWith('encargado_eventos')).length} personas`)

  const personas = new Set(finales.map(v => v.member_id))
  console.log(`\n══ RESULTADO: ${finales.length} asignaciones activas · ${personas.size} personas`)
  require('node:fs').writeFileSync('scripts/depuracion-2026-09-12/dobles.json', JSON.stringify(cerrarUnicos, null, 1))
}
main().catch(e => { console.error(e); process.exit(1) })
