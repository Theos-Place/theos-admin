/**
 * Consolida los puestos repetidos de cada comité: "Colaborador Información" y
 * "Colaborador de Informacion" son UNO. Sobrevive el que NO lleva "de"
 * (decisión del usuario, 2026-09-10); si el único candidato lo lleva, se le
 * quita del título.
 *
 * EL ORDEN IMPORTA. Borrar un puesto arrastra en CASCADE sus `volunteers` y sus
 * `member_role_position_grants` — el respaldo de los roles automáticos. Por eso
 * primero se ASIGNA a la persona al sobreviviente (que recrea el respaldo) y
 * solo después se la quita del perdedor. Al revés, entre los dos pasos, alguien
 * podría quedar con un rol sin nada que lo sostenga.
 *
 *   NODE_OPTIONS="--conditions=react-server" npx tsx --env-file=.env.local scripts/puestos-duplicados-2026-09/consolidar.ts
 *   ... --aplicar
 */
import { createAdminClient } from '../../src/lib/supabase/admin'
import { assignVolunteer, removeVolunteer } from '../../src/lib/supabase/queries/servers'
import { normalizarTitulo, planDeConsolidacion, type PuestoCandidato } from '../../src/lib/servers/puestos-duplicados'

const aplicar = process.argv.includes('--aplicar')

async function todo<T>(tabla: string, select: string, filtro?: (q: never) => never): Promise<T[]> {
  const sb = createAdminClient()
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    let q = sb.from(tabla as 'service_positions').select(select).range(from, from + 999)
    if (filtro) q = (filtro as unknown as (x: typeof q) => typeof q)(q)
    const { data, error } = await q
    if (error) throw error
    const filas = (data ?? []) as unknown as T[]
    out.push(...filas)
    if (filas.length < 1000) break
  }
  return out
}

async function main() {
  const sb = createAdminClient()
  const areas = await todo<{ id: string; name: string }>('areas', 'id, name')
  const nombreArea = new Map(areas.map(a => [a.id, a.name]))
  const puestos = await todo<{ id: string; title: string; area_id: string }>('service_positions', 'id, title, area_id')
  const vols = await todo<{ member_id: string; position_id: string; status: string }>('volunteers', 'member_id, position_id, status')

  const porPuesto = new Map<string, { activos: string[]; inactivos: string[] }>()
  for (const v of vols) {
    const e = porPuesto.get(v.position_id) ?? { activos: [], inactivos: [] }
    ;(v.status === 'active' ? e.activos : e.inactivos).push(v.member_id)
    porPuesto.set(v.position_id, e)
  }

  // Agrupar por comité + título normalizado.
  const grupos = new Map<string, PuestoCandidato[]>()
  for (const p of puestos) {
    const k = `${p.area_id}::${normalizarTitulo(p.title)}`
    grupos.set(k, [...(grupos.get(k) ?? []), {
      id: p.id, title: p.title, activos: (porPuesto.get(p.id)?.activos ?? []).length,
    }])
  }

  // FOTO DE ROLES antes de tocar nada. Es la única forma de PROBAR que mover
  // gente entre puestos no le quitó un permiso a nadie: el respaldo de los
  // roles automáticos se borra en CASCADE con el puesto.
  const rolesAntes = await todo<{ member_id: string; role: string; is_active: boolean }>(
    'member_roles', 'member_id, role, is_active')
  const fotoRoles = new Map<string, string>()
  for (const r of rolesAntes) if (r.is_active) fotoRoles.set(`${r.member_id}|${r.role}`, '1')
  console.log(`foto: ${fotoRoles.size} roles activos antes de empezar`)

  let pares = 0, movidas = 0, renombrados = 0, borrados = 0
  for (const [k, candidatos] of grupos) {
    const plan = planDeConsolidacion(candidatos)
    if (!plan) continue
    pares++
    const areaId = k.split('::')[0]
    console.log(`\n══ ${nombreArea.get(areaId)}`)
    console.log(`   queda: «${plan.tituloFinal}»${plan.tituloFinal !== plan.sobreviviente.title ? ` (se le quita el "de" a «${plan.sobreviviente.title}»)` : ''} — ${plan.sobreviviente.activos} activos`)

    if (plan.tituloFinal !== plan.sobreviviente.title) {
      renombrados++
      if (aplicar) {
        const { error } = await sb.from('service_positions')
          .update({ title: plan.tituloFinal }).eq('id', plan.sobreviviente.id)
        if (error) throw error
      }
    }

    for (const perdedor of plan.aBorrar) {
      const gente = porPuesto.get(perdedor.id) ?? { activos: [], inactivos: [] }
      console.log(`   se va: «${perdedor.title}» — mover ${gente.activos.length} activos, ${gente.inactivos.length} históricos`)
      if (!aplicar) continue

      // 1. Activos: primero al sobreviviente (recrea el respaldo del rol),
      //    después se los quita del perdedor.
      for (const memberId of gente.activos) {
        await assignVolunteer(plan.sobreviviente.id, memberId)
        await removeVolunteer(perdedor.id, memberId)
        movidas++
      }
      // 2. Históricos: se mudan si la persona no tiene ya fila en el que queda;
      //    si la tiene, es el mismo hecho dos veces y se descarta.
      const yaEn = new Set([
        ...(porPuesto.get(plan.sobreviviente.id)?.activos ?? []),
        ...(porPuesto.get(plan.sobreviviente.id)?.inactivos ?? []),
        ...gente.activos,
      ])
      for (const memberId of gente.inactivos) {
        if (yaEn.has(memberId)) continue
        await sb.from('volunteers').update({ position_id: plan.sobreviviente.id })
          .eq('position_id', perdedor.id).eq('member_id', memberId)
      }
      // 3. Vacantes: se repuntan, o el DELETE las deja huérfanas (SET NULL).
      await sb.from('vacancies').update({ position_id: plan.sobreviviente.id }).eq('position_id', perdedor.id)

      // 4. Recién ahora se borra, y solo si de verdad quedó vacío.
      const { count } = await sb.from('volunteers')
        .select('member_id', { count: 'exact', head: true })
        .eq('position_id', perdedor.id).eq('status', 'active')
      if ((count ?? 0) > 0) throw new Error(`«${perdedor.title}» todavía tiene ${count} activos. No se borra.`)
      const { error } = await sb.from('service_positions').delete().eq('id', perdedor.id)
      if (error) throw error
      borrados++
    }
  }

  console.log(`\n${pares} nombres repetidos · ${renombrados} títulos sin el "de" · ${movidas} asignaciones movidas · ${borrados} puestos borrados`)
  if (!aplicar) { console.log('\nSimulacro. Volvé a correrlo con --aplicar.'); return }

  const rolesDespues = await todo<{ member_id: string; role: string; is_active: boolean }>(
    'member_roles', 'member_id, role, is_active')
  const ahora = new Set(rolesDespues.filter(r => r.is_active).map(r => `${r.member_id}|${r.role}`))
  const perdidos = [...fotoRoles.keys()].filter(k => !ahora.has(k))
  const ganados = [...ahora].filter(k => !fotoRoles.has(k))
  console.log(`\nroles perdidos: ${perdidos.length}${perdidos.length ? ' → ' + perdidos.join(', ') : ' (ninguno, como tiene que ser)'}`)
  console.log(`roles ganados:  ${ganados.length}${ganados.length ? ' → ' + ganados.join(', ') : ''}`)

  // Ningún puesto repetido debería quedar.
  const quedan = await todo<{ id: string; title: string; area_id: string }>('service_positions', 'id, title, area_id')
  const g = new Map<string, number>()
  for (const p2 of quedan) {
    const k = `${p2.area_id}::${normalizarTitulo(p2.title)}`
    g.set(k, (g.get(k) ?? 0) + 1)
  }
  const restan = [...g.values()].filter(n => n > 1).length
  console.log(`nombres repetidos que quedan: ${restan}`)
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
