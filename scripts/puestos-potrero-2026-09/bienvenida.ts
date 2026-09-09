/**
 * Sede Potrero: crear el puesto "Colaborador Bienvenida" y asignar a las tres
 * personas que hacen check-in, SIN tocar los puestos que ya tienen.
 *
 * El título no es decorativo: "Colaborador Bienvenida" es el que reconoce
 * POSITION_ROLE_RULES para otorgar `encargado_eventos` en un comité de sede
 * (10 de las 13 sedes lo escriben así). Con "Bienvenida" a secas la regla NO
 * matchea y no habría permiso automático.
 *
 * Va por assignVolunteer(), la misma función de la pantalla, para que el rol
 * quede respaldado en member_role_position_grants: un INSERT directo en
 * member_roles deja el rol imposible de quitar al desasignar el puesto.
 *
 * Idempotente: correrlo dos veces no duplica nada.
 *
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/puestos-potrero-2026-09/bienvenida.ts        (simulacro)
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/puestos-potrero-2026-09/bienvenida.ts --aplicar
 */
import { readFileSync } from 'fs'

// Antes de cualquier import que valide el entorno (src/lib/env.ts revienta si
// falta una variable), de ahí los import dinámicos de abajo.
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const SEDE_POTRERO = '51e03632-4c4a-4418-86de-b8d7420a2790'
const TITULO = 'Colaborador Bienvenida'
const PERSONAS = ['Mirtha Cruz Graña', 'Darla Murillo', 'Diana Madriz Giron']

const aplicar = process.argv.includes('--aplicar')

async function main() {
  const { createAdminClient } = await import('../../src/lib/supabase/admin')
  const { assignVolunteer } = await import('../../src/lib/supabase/queries/servers')
  const { rolesGrantedByPosition } = await import('../../src/lib/servers/position-roles')
  const sb = createAdminClient()

  const { data: sede } = await sb.from('areas').select('name, parent_id').eq('id', SEDE_POTRERO).single()
  const { data: padre } = await sb.from('areas').select('name').eq('id', sede!.parent_id!).single()
  console.log(`Comité: ${sede!.name} (padre: ${padre!.name})`)

  // El puesto otorga el rol que esperamos, según la regla real.
  const roles = rolesGrantedByPosition({
    title: TITULO, areaName: sede!.name, areaType: 'committee', parentAreaName: padre!.name,
  })
  console.log(`Puesto "${TITULO}" → roles automáticos: ${roles.length ? roles.join(', ') : 'NINGUNO'}`)
  if (!roles.includes('encargado_eventos')) {
    throw new Error('El título no otorga encargado_eventos. Abortando antes de crear nada.')
  }

  // 1. El puesto
  const { data: existente } = await sb.from('service_positions')
    .select('id').eq('area_id', SEDE_POTRERO).eq('title', TITULO).maybeSingle()
  let positionId = existente?.id as string | undefined
  if (positionId) {
    console.log(`\nEl puesto ya existe (${positionId}), no se crea de nuevo.`)
  } else if (!aplicar) {
    console.log(`\n[simulacro] se crearía el puesto "${TITULO}" en ${sede!.name}`)
  } else {
    const { data, error } = await sb.from('service_positions')
      .insert({ area_id: SEDE_POTRERO, title: TITULO, is_active: true, quantity: PERSONAS.length })
      .select('id').single()
    if (error) throw error
    positionId = data.id
    console.log(`\nPuesto creado: ${positionId}`)
  }

  // 2. Las personas — por nombre completo exacto, nunca por LIKE parcial.
  for (const nombre of PERSONAS) {
    const { data: candidatos } = await sb.from('members')
      .select('id, first_name, last_name, is_active')
      .ilike('first_name', nombre.split(' ')[0])
    const encontrados = (candidatos ?? []).filter(
      m => `${m.first_name} ${m.last_name}`.trim() === nombre,
    )
    if (encontrados.length !== 1) {
      console.log(`  ⚠️  ${nombre}: ${encontrados.length} coincidencias exactas — se omite`)
      continue
    }
    const m = encontrados[0]

    // Lo que YA tiene, para dejar constancia de que no se le quita nada.
    const { data: previos, error: errPrevios } = await sb.from('volunteers')
      .select('position_id')
      .eq('member_id', m.id).eq('status', 'active')
    // Este listado NO es cosmético: es la prueba de que no se le quita nada.
    // Si falla, se aborta en vez de imprimir "(ninguno)" y seguir.
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
      console.log(`  [simulacro] ${nombre} → ${TITULO}; conserva: ${lista.join(' | ') || '(ninguno)'}`)
      continue
    }
    await assignVolunteer(positionId, m.id)
    const { data: rolesAhora } = await sb.from('member_roles').select('role').eq('member_id', m.id)
    console.log(`  ✓ ${nombre} → ${TITULO}`)
    console.log(`      conserva: ${lista.join(' | ') || '(ninguno)'}`)
    console.log(`      roles ahora: ${(rolesAhora ?? []).map(r => r.role).join(', ')}`)
  }

  if (!aplicar) console.log('\nSimulacro. Volvé a correrlo con --aplicar para escribir.')
}

main().catch(e => { console.error(e); process.exit(1) })
