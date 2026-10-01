/**
 * Reparte los roles que los PUESTOS ya deberían haber dado.
 *
 * LA CAUSA (medida el 2026-10-01): la sincronización corre cuando alguien
 * TOCA la asignación. Los puestos del Comité Servidores se asignaron el
 * 26-ago y las reglas que les dan rol se escribieron el 25-set (SRV-11 y
 * SRV-14), un mes después. Nadie volvió a tocar las asignaciones, así que
 * NADIE recibió nunca esos roles — cero vínculos en todo el padrón.
 *
 * No es un bug de la regla: faltó el backfill cuando la regla salió. Por eso
 * este script existe y conviene correrlo cada vez que se agregue una regla
 * nueva a `position-roles.ts`.
 *
 * Usa `grant_position_role`, que crea el VÍNCULO al puesto además del rol.
 * Ese vínculo es lo que hace que el acceso se vaya solo cuando la persona
 * deja el puesto.
 *
 * EL CASO MANUAL, aparte y a propósito: un rol dado a mano NO lo revoca
 * `revoke_position_role` —se detiene si el origen no es 'automatico'—, así
 * que un rol correcto pero manual deja el acceso puesto para siempre. El
 * script los LISTA y solo los convierte con --normalizar, porque un rol
 * manual también puede haberse dado por una razón ajena al puesto y
 * convertirlo le pondría fecha de vencimiento sin que nadie lo pidiera.
 *
 *   ENV_FILE=.env.local npx tsx scripts/srv-roles/aplicar.ts
 *   ENV_FILE=.env.local npx tsx scripts/srv-roles/aplicar.ts --aplicar
 *   ENV_FILE=.env.local npx tsx scripts/srv-roles/aplicar.ts --aplicar --normalizar
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { rolesGrantedByPosition } from '../../src/lib/servers/position-roles'

const APLICAR = process.argv.includes('--aplicar')
const NORMALIZAR = process.argv.includes('--normalizar')
const ARCHIVO_ENV = process.env.ENV_FILE || '.env.local'
const env = Object.fromEntries(
  readFileSync(ARCHIVO_ENV, 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trimStart().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

type Caso = {
  member_id: string; persona: string; position_id: string; puesto: string; area: string
  rol: string; tiene: boolean; origen: string | null; vinculado: boolean
}

async function reunir(): Promise<Caso[]> {
  const asignaciones: Array<{
    member_id: string; position_id: string
    members: { first_name: string; last_name: string | null } | null
    service_positions: { title: string; areas: { name: string; area_type: string; parent_id: string | null } | null } | null
  }> = []
  for (let d = 0; ; d += 1000) {
    const { data, error } = await db.from('volunteers')
      .select('member_id, position_id, members(first_name, last_name), service_positions(title, areas!service_positions_area_id_fkey(name, area_type, parent_id))')
      .eq('status', 'active').order('member_id').range(d, d + 999)
    if (error) throw new Error(error.message)
    asignaciones.push(...(data ?? []) as typeof asignaciones)
    if ((data ?? []).length < 1000) break
  }

  const { data: areas } = await db.from('areas').select('id, name')
  const padre = new Map((areas ?? []).map((a: { id: string; name: string }) => [a.id, a.name]))

  const roles = new Map<string, { activo: boolean; origen: string | null }>()
  for (let d = 0; ; d += 1000) {
    const { data } = await db.from('member_roles')
      .select('member_id, role, is_active, origen').order('member_id').range(d, d + 999)
    for (const r of (data ?? []) as Array<{ member_id: string; role: string; is_active: boolean; origen: string | null }>) {
      roles.set(`${r.member_id}|${r.role}`, { activo: r.is_active, origen: r.origen })
    }
    if ((data ?? []).length < 1000) break
  }

  const vinculos = new Set<string>()
  for (let d = 0; ; d += 1000) {
    const { data } = await db.from('member_role_position_grants')
      .select('member_id, role, position_id').order('member_id').range(d, d + 999)
    for (const g of (data ?? []) as Array<{ member_id: string; role: string; position_id: string }>) {
      vinculos.add(`${g.member_id}|${g.role}|${g.position_id}`)
    }
    if ((data ?? []).length < 1000) break
  }

  const out: Caso[] = []
  for (const a of asignaciones) {
    const p = a.service_positions, ar = p?.areas
    if (!p || !ar) continue
    for (const rol of rolesGrantedByPosition({
      title: p.title, areaName: ar.name, areaType: ar.area_type,
      parentAreaName: ar.parent_id ? padre.get(ar.parent_id) ?? null : null,
    })) {
      const r = roles.get(`${a.member_id}|${rol}`)
      out.push({
        member_id: a.member_id,
        persona: `${a.members?.first_name ?? '?'} ${a.members?.last_name ?? ''}`.trim(),
        position_id: a.position_id, puesto: p.title, area: ar.name, rol,
        tiene: !!r?.activo, origen: r?.origen ?? null,
        vinculado: vinculos.has(`${a.member_id}|${rol}|${a.position_id}`),
      })
    }
  }
  return out
}

async function main() {
  const casos = await reunir()
  const sinRol = casos.filter(c => !c.tiene)
  const sinVinculo = casos.filter(c => c.tiene && !c.vinculado)
  const manuales = casos.filter(c => c.tiene && c.origen !== 'automatico')

  console.log(`\nBase: ${ARCHIVO_ENV} · ${APLICAR ? 'APLICANDO' : 'dry-run'}\n`)
  console.log(`Puestos que dan rol: ${casos.length}`)
  console.log(`  · sin el rol:                ${sinRol.length}`)
  console.log(`  · con el rol, sin vínculo:   ${sinVinculo.length}`)
  console.log(`  · con el rol pero MANUAL:    ${manuales.length}`)

  if (sinRol.length) { console.log('\nLes falta el rol:'); console.table(sinRol.map(c => ({ persona: c.persona, puesto: c.puesto, area: c.area, rol: c.rol }))) }
  if (sinVinculo.length) { console.log('\nTienen el rol pero sin vínculo al puesto (no se revocaría al salir):'); console.table(sinVinculo.map(c => ({ persona: c.persona, puesto: c.puesto, rol: c.rol, origen: c.origen }))) }

  if (!APLICAR) { console.log('\n(dry-run: no se escribió nada. Agregá --aplicar.)\n'); return }

  let otorgados = 0
  for (const c of [...sinRol, ...sinVinculo]) {
    const { error } = await db.rpc('grant_position_role', {
      p_member_id: c.member_id, p_role: c.rol, p_position_id: c.position_id,
    })
    if (error) throw new Error(`${c.persona} / ${c.rol}: ${error.message}`)
    otorgados++
  }
  console.log(`\n✓ ${otorgados} roles otorgados o vinculados a su puesto.`)

  if (manuales.length) {
    if (!NORMALIZAR) {
      console.log(`\n⚠ ${manuales.length} siguen con origen MANUAL. El acceso NO se les va a quitar`)
      console.log('  cuando dejen el puesto, porque revoke_position_role respeta lo manual.')
      console.log('  Para convertirlos: volvé a correr con --normalizar.')
    } else {
      for (const c of manuales) {
        const { error } = await db.from('member_roles')
          .update({ origen: 'automatico' })
          .eq('member_id', c.member_id).eq('role', c.rol).eq('is_active', true)
        if (error) throw new Error(`normalizar ${c.persona}: ${error.message}`)
      }
      console.log(`\n✓ ${manuales.length} pasaron de 'manual' a 'automatico': ahora siguen la vida del puesto.`)
    }
  }
}

main().catch(e => { console.error('✗', e.message); process.exit(1) })
