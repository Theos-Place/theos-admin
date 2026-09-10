/**
 * Sede Pérez Zeledón: crear el puesto "Colaborador Bienvenida" y asignárselo a
 * Hellen Patricia Galeano Solano, SIN tocar el puesto que ya tiene.
 *
 * El título no es decorativo: "Colaborador Bienvenida" es el que reconoce
 * POSITION_ROLE_RULES para otorgar `encargado_eventos` en un comité de sede.
 * Con "Bienvenida" a secas la regla NO matchea y no habría permiso automático.
 *
 * OJO (verificado 2026-09-10): hay DOS fichas de esta persona. Se usa la que
 * ella de verdad usa para entrar —galeanohellen31@gmail.com, la que ya está en
 * el comité—, no la otra (galleanohellen31, con dos eles), que nunca ingresó
 * aunque tenga el historial de check-ins. Fusionarlas es aparte.
 *
 * Va por assignVolunteer(), la misma función de la pantalla, para que el rol
 * quede respaldado en member_role_position_grants: un INSERT directo en
 * member_roles deja el rol imposible de quitar al desasignar el puesto.
 *
 * Idempotente: correrlo dos veces no duplica nada.
 *
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/puestos-perez-zeledon-2026-09/bienvenida.ts
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/puestos-perez-zeledon-2026-09/bienvenida.ts --aplicar
 */
import { readFileSync } from 'fs'

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const SEDE_PZ = 'c9337841-5db5-4131-a8f0-4972340418fe'
const TITULO = 'Colaborador Bienvenida'
// Por id y no por nombre: hay una ficha casi idéntica y un LIKE agarraría la
// equivocada. Ver la nota de arriba.
const MEMBER_ID = '8f8d3125-0081-41e5-9755-c61f9b214def'

const aplicar = process.argv.includes('--aplicar')

async function main() {
  const { createAdminClient } = await import('../../src/lib/supabase/admin')
  const { assignVolunteer } = await import('../../src/lib/supabase/queries/servers')
  const { rolesGrantedByPosition } = await import('../../src/lib/servers/position-roles')
  const sb = createAdminClient()

  const { data: sede } = await sb.from('areas').select('name, parent_id, area_type').eq('id', SEDE_PZ).single()
  const { data: padre } = await sb.from('areas').select('name').eq('id', sede!.parent_id!).single()
  console.log(`Comité: ${sede!.name} (padre: ${padre!.name})`)

  const roles = rolesGrantedByPosition({
    title: TITULO, areaName: sede!.name, areaType: 'committee', parentAreaName: padre!.name,
  })
  console.log(`Puesto "${TITULO}" → roles automáticos: ${roles.length ? roles.join(', ') : 'NINGUNO'}`)
  if (!roles.includes('encargado_eventos')) {
    throw new Error('El título no otorga encargado_eventos. Abortando antes de crear nada.')
  }

  // 1. El puesto
  const { data: existente } = await sb.from('service_positions')
    .select('id').eq('area_id', SEDE_PZ).eq('title', TITULO).maybeSingle()
  let positionId = existente?.id as string | undefined
  if (positionId) {
    console.log(`\nEl puesto ya existe (${positionId}), no se crea de nuevo.`)
  } else if (!aplicar) {
    console.log(`\n[simulacro] se crearía el puesto "${TITULO}" en ${sede!.name}`)
  } else {
    const { data, error } = await sb.from('service_positions')
      .insert({ area_id: SEDE_PZ, title: TITULO, is_active: true, quantity: 1 })
      .select('id').single()
    if (error) throw error
    positionId = data.id
    console.log(`\nPuesto creado: ${positionId}`)
  }

  // 2. La persona
  const { data: m, error: errM } = await sb.from('members')
    .select('id, first_name, last_name, email').eq('id', MEMBER_ID).single()
  if (errM) throw errM
  const nombre = `${m.first_name} ${m.last_name}`.trim()

  // Lo que YA tiene. No es cosmético: es la prueba de que no se le quita nada.
  const { data: previos, error: errPrevios } = await sb.from('volunteers')
    .select('position_id').eq('member_id', m.id).eq('status', 'active')
  if (errPrevios) throw errPrevios
  const idsPrevios = (previos ?? []).map(v => v.position_id)
  const { data: puestosPrevios, error: errPuestos } = idsPrevios.length
    ? await sb.from('service_positions').select('id, title, area_id').in('id', idsPrevios)
    : { data: [], error: null }
  if (errPuestos) throw errPuestos
  const areaIds = [...new Set((puestosPrevios ?? []).map(p => p.area_id))]
  const { data: areasPrevias } = areaIds.length
    ? await sb.from('areas').select('id, name').in('id', areaIds)
    : { data: [] }
  const nombreArea = new Map((areasPrevias ?? []).map(a => [a.id, a.name]))
  const lista = (puestosPrevios ?? []).map(p => `${p.title} @ ${nombreArea.get(p.area_id) ?? '?'}`)

  if (!aplicar || !positionId) {
    console.log(`  [simulacro] ${nombre} (${m.email}) → ${TITULO}`)
    console.log(`              conserva: ${lista.join(' | ') || '(ninguno)'}`)
    console.log('\nSimulacro. Volvé a correrlo con --aplicar para escribir.')
    return
  }

  await assignVolunteer(positionId, m.id)
  const { data: rolesAhora } = await sb.from('member_roles').select('role, is_active').eq('member_id', m.id)
  console.log(`  ✓ ${nombre} (${m.email}) → ${TITULO}`)
  console.log(`      conserva: ${lista.join(' | ') || '(ninguno)'}`)
  console.log(`      roles ahora: ${(rolesAhora ?? []).map(r => `${r.role}${r.is_active ? '' : ' (inactivo)'}`).join(', ') || '(ninguno)'}`)
}

main().catch(e => { console.error(e); process.exit(1) })
