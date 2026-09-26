/**
 * RET-1 · Le aplica el rol de EVALUACIONES a quienes ya tienen el puesto
 * de retroalimentación del comité de Dirigentes (decisión de Floriana, 2026-09-25).
 *
 * Hace falta un script porque `position-role-sync` corre al ASIGNAR un puesto,
 * no al cambiar la regla: las personas que ya tienen el puesto no lo reciben solas.
 * Mismo caso y mismo patrón que `scripts/youth/aplicar-bienvenida.ts`.
 *
 * Usa `syncRolesOnAssign`, la misma función de la pantalla de servidores, para
 * que el rol quede con origen 'automatico' y su respaldo en el puesto — si
 * mañana alguien sale del puesto, el rol se le cae solo. Escribirlo a mano
 * dejaría un rol manual que nadie volvería a quitar.
 *
 * NO se listan los puestos a mano: se buscan por la REGLA, así que si el
 * catálogo cambia el script sigue mirando lo mismo que el sistema.
 *
 * Dry-run por defecto; --aplicar escribe.
 *
 * Uso (OJO con NODE_OPTIONS: los módulos de queries hacen `import 'server-only'`):
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/ret1/aplicar-evaluaciones.ts
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/ret1/aplicar-evaluaciones.ts --aplicar
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// El entorno se carga ANTES de importar nada de la app: `lib/env` valida al
// evaluar el módulo y sin esto revienta al arrancar. Por eso estos imports van
// abajo y no arriba (tsx compila a CJS y respeta el orden).
for (const file of ['.env', '.env.local']) {
  try {
    for (const line of readFileSync(join(process.cwd(), file), 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* sigue */ }
}

import type { PositionContext } from '@/lib/servers/position-roles'

const APLICAR = process.argv.includes('--aplicar')
const ROL = 'evaluaciones'
const ACTOR = 'ti@theosplace.org'

type Area = { name: string; area_type: 'area' | 'committee'; parent_id: string | null }

async function main() {
  // Importación DINÁMICA: `lib/env` valida el entorno al evaluarse, y un
  // `import` normal se iza por encima del cargador de arriba — probado, no
  // supuesto: con imports estáticos esto revienta antes de la primera línea.
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const { syncRolesOnAssign } = await import('@/lib/supabase/queries/position-role-sync')
  const { rolesGrantedByPosition } = await import('@/lib/servers/position-roles')

  const sb = createAdminClient()

  // 1. Todos los puestos activos, con su área, para preguntarle a la REGLA
  //    cuáles otorgan el rol. Preguntar por título sería adivinar lo que el
  //    sistema ya sabe responder.
  const { data: pos } = await sb.from('service_positions')
    .select('id, title, is_active, area:areas!service_positions_area_id_fkey(name, area_type, parent_id)')
    .eq('is_active', true)
  const puestos = (pos ?? []) as Array<{ id: string; title: string; area: Area | Area[] | null }>

  const padres = new Map<string, string>()
  const { data: areas } = await sb.from('areas').select('id, name')
  for (const a of (areas ?? []) as Array<{ id: string; name: string }>) padres.set(a.id, a.name)

  const otorgan: Array<{ id: string; title: string; area: string }> = []
  for (const p of puestos) {
    const area = (Array.isArray(p.area) ? p.area[0] : p.area) ?? null
    if (!area) continue
    const ctx: PositionContext = {
      title: p.title, areaName: area.name, areaType: area.area_type,
      parentAreaName: area.parent_id ? (padres.get(area.parent_id) ?? null) : null,
    }
    if (rolesGrantedByPosition(ctx).includes(ROL)) otorgan.push({ id: p.id, title: p.title, area: area.name })
  }

  console.log(`puestos activos que otorgan "${ROL}": ${otorgan.length}`)
  for (const p of otorgan) console.log(`  · ${p.title} — ${p.area}`)
  if (otorgan.length === 0) throw new Error('GUARDA: ningún puesto otorga el rol — no hay nada que aplicar')

  // 2. Quién los ocupa hoy.
  const { data: au } = await sb.from('members').select('auth_user_id').eq('email', ACTOR).maybeSingle()
  const actor = (au as { auth_user_id: string } | null)?.auth_user_id ?? undefined

  let dados = 0
  let yaTenian = 0
  console.log('')
  for (const p of otorgan) {
    const { data: v } = await sb.from('volunteers')
      .select('member_id, members!volunteers_member_id_fkey(first_name, last_name)')
      .eq('position_id', p.id).eq('status', 'active')
    const gente = (v ?? []) as Array<{ member_id: string; members: { first_name: string; last_name: string } }>
    for (const g of gente) {
      const nombre = `${g.members.first_name} ${g.members.last_name}`
      const { data: antes } = await sb.from('member_roles').select('is_active, origen')
        .eq('member_id', g.member_id).eq('role', ROL).maybeSingle()
      const tenia = (antes as { is_active: boolean } | null)?.is_active ?? false
      if (tenia) { yaTenian++; console.log(`  ${nombre.padEnd(32)} ya lo tiene`); continue }
      if (!APLICAR) { console.log(`  ${nombre.padEnd(32)} → se le daría (${p.area})`); continue }
      await syncRolesOnAssign(g.member_id, p.id, actor)
      const { data: post } = await sb.from('member_roles').select('is_active, origen')
        .eq('member_id', g.member_id).eq('role', ROL).maybeSingle()
      const r = post as { is_active: boolean; origen: string } | null
      if (r?.is_active) dados++
      console.log(`  ${nombre.padEnd(32)} ${r?.is_active ? `✓ ${r.origen}` : '‼ NO QUEDÓ'}`)
    }
  }
  console.log(`\n${APLICAR ? `aplicado: ${dados} altas` : 'DRY-RUN: no se escribió nada'} · ya lo tenían: ${yaTenian}`)
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
