/**
 * ¿A quién le falta el rol que su PUESTO le debería dar?
 *
 * La sincronización de roles por puesto corre cuando alguien TOCA la
 * asignación (la crea, la cambia, la da de baja). Un puesto que ya existía
 * cuando la regla se escribió —o que se cargó por import— nunca pasa por
 * ahí, así que la persona queda con el puesto y sin el rol, en silencio.
 *
 * Reportado el 2026-10-01 con Diana Bermudez y Jazmin Sanchez, del Comité
 * Servidores. El script busca TODOS los casos, porque dos reportados casi
 * nunca son dos.
 *
 * Solo lee. Para aplicar: scripts/srv-roles/aplicar.ts
 *
 *   ENV_FILE=.env.local npx tsx scripts/srv-roles/auditar.ts
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { rolesGrantedByPosition } from '../../src/lib/servers/position-roles'

const ARCHIVO_ENV = process.env.ENV_FILE || '.env.local'
const env = Object.fromEntries(
  readFileSync(ARCHIVO_ENV, 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trimStart().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

export type Falta = {
  member_id: string; persona: string; puesto: string; area: string; rol: string
}

export async function faltantes(): Promise<Falta[]> {
  // Todas las asignaciones ACTIVAS con su puesto y su área.
  const filas: Array<{
    member_id: string
    members: { first_name: string; last_name: string | null } | null
    service_positions: {
      title: string
      areas: { name: string; area_type: string; parent_id: string | null } | null
    } | null
  }> = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db.from('volunteers')
      .select('member_id, members(first_name, last_name), service_positions(title, areas!service_positions_area_id_fkey(name, area_type, parent_id))')
      .eq('status', 'active').range(desde, desde + 999)
    if (error) throw new Error(error.message)
    filas.push(...(data ?? []) as typeof filas)
    if ((data ?? []).length < 1000) break
  }

  // Nombres de las áreas padre: la regla de comités de sede los mira.
  const { data: areas } = await db.from('areas').select('id, name')
  const nombrePadre = new Map((areas ?? []).map((a: { id: string; name: string }) => [a.id, a.name]))

  // Roles activos que cada quien YA tiene.
  const tiene = new Map<string, Set<string>>()
  for (let desde = 0; ; desde += 1000) {
    const { data } = await db.from('member_roles')
      .select('member_id, role').eq('is_active', true).range(desde, desde + 999)
    for (const r of (data ?? []) as Array<{ member_id: string; role: string }>) {
      if (!tiene.has(r.member_id)) tiene.set(r.member_id, new Set())
      tiene.get(r.member_id)!.add(r.role)
    }
    if ((data ?? []).length < 1000) break
  }

  const out: Falta[] = []
  for (const f of filas) {
    const p = f.service_positions
    const a = p?.areas
    if (!p || !a) continue
    const roles = rolesGrantedByPosition({
      title: p.title, areaName: a.name, areaType: a.area_type,
      parentAreaName: a.parent_id ? nombrePadre.get(a.parent_id) ?? null : null,
    })
    for (const rol of roles) {
      if (tiene.get(f.member_id)?.has(rol)) continue
      out.push({
        member_id: f.member_id,
        persona: `${f.members?.first_name ?? '?'} ${f.members?.last_name ?? ''}`.trim(),
        puesto: p.title, area: a.name, rol,
      })
    }
  }
  return out
}

if (process.argv[1]?.includes('auditar')) {
  faltantes().then(f => {
    console.log(`\nBase: ${ARCHIVO_ENV}\nPersonas con un puesto que da rol y SIN ese rol: ${f.length}\n`)
    console.table(f.map(x => ({ persona: x.persona, puesto: x.puesto, area: x.area, 'rol que falta': x.rol })))
    const porRol: Record<string, number> = {}
    for (const x of f) porRol[x.rol] = (porRol[x.rol] ?? 0) + 1
    console.log('\nPor rol:'); console.table(Object.entries(porRol).map(([rol, n]) => ({ rol, n })))
  }).catch(e => { console.error('✗', e.message); process.exit(1) })
}
