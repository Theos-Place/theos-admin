/**
 * Comité Matrimonios: crear el puesto «Colaborador Bienvenida» y asignar a las
 * cuatro personas que harán el check-in del evento de parejas (2026-10-31),
 * SIN tocar los puestos que ya tienen (Colaborador / Encargado Comité).
 *
 * El título no es decorativo: la regla MAT-1 de POSITION_ROLE_RULES otorga
 * `encargado_eventos` a «Colaborador Bienvenida» del Comité Matrimonios, y por
 * EVE-12 ese rol automático alcanza solo los eventos del comité.
 *
 * Mismo molde que scripts/puestos-potrero-2026-09/bienvenida.ts: va por
 * assignVolunteer() para que el rol quede respaldado en
 * member_role_position_grants. Idempotente.
 *
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/matrimonios-2026-10-29/bienvenida.ts            (simulacro)
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/matrimonios-2026-10-29/bienvenida.ts --aplicar
 */
import { readFileSync } from 'fs'

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const COMITE_MATRIMONIOS = 'a2b43871-d979-4cd5-99fa-fd1fb4b7a78f'
const TITULO = 'Colaborador Bienvenida'
// Por id, no por nombre: hay dos «Fiorella Umaña» en el padrón; Floriana se
// refiere a la que ya sirve en el comité (Umaña Vindas).
const PERSONAS: Array<{ id: string; nombre: string }> = [
  { id: 'bc8c3560-670c-42cd-b2eb-50666ad41f1b', nombre: 'Jorge Arturo Gallo Saenz' },
  { id: 'd1cc7b92-16f4-459b-b5ef-4f5385cd7094', nombre: 'Milagro Prado Vásquez' },
  { id: '52ee8bbc-e343-4864-b464-7395e311e86b', nombre: 'Fiorella Umaña Vindas' },
  { id: '31642f54-2473-4469-8312-891806ef2032', nombre: 'Daniela Conejo' },
]

const aplicar = process.argv.includes('--aplicar')

async function main() {
  const { createAdminClient } = await import('../../src/lib/supabase/admin')
  const { assignVolunteer } = await import('../../src/lib/supabase/queries/servers')
  const { rolesGrantedByPosition } = await import('../../src/lib/servers/position-roles')
  const sb = createAdminClient()

  const { data: comite } = await sb.from('areas').select('name, parent_id').eq('id', COMITE_MATRIMONIOS).single()
  const { data: padre } = await sb.from('areas').select('name').eq('id', comite!.parent_id!).single()
  console.log(`Comité: ${comite!.name} (padre: ${padre!.name})`)

  const roles = rolesGrantedByPosition({
    title: TITULO, areaName: comite!.name, areaType: 'committee', parentAreaName: padre!.name,
  })
  console.log(`Puesto "${TITULO}" → roles automáticos: ${roles.length ? roles.join(', ') : 'NINGUNO'}`)
  if (!roles.includes('encargado_eventos')) throw new Error('El título no otorga encargado_eventos. Abortando.')

  const { data: existente } = await sb.from('service_positions')
    .select('id').eq('area_id', COMITE_MATRIMONIOS).eq('title', TITULO).maybeSingle()
  let positionId = existente?.id as string | undefined
  if (positionId) {
    console.log(`\nEl puesto ya existe (${positionId}).`)
  } else if (!aplicar) {
    console.log(`\n[simulacro] se crearía el puesto "${TITULO}" en ${comite!.name}`)
  } else {
    const { data, error } = await sb.from('service_positions')
      .insert({ area_id: COMITE_MATRIMONIOS, title: TITULO, is_active: true, quantity: PERSONAS.length, max_volunteers: PERSONAS.length })
      .select('id').single()
    if (error) throw error
    positionId = data.id
    console.log(`\nPuesto creado: ${positionId}`)
  }

  for (const p of PERSONAS) {
    const { data: m, error: em } = await sb.from('members').select('id, first_name, last_name, is_active').eq('id', p.id).single()
    if (em || !m) throw new Error(`${p.nombre}: sin ficha`)
    const nombreReal = `${m.first_name} ${m.last_name}`.trim()
    if (nombreReal !== p.nombre) throw new Error(`${p.id} es «${nombreReal}», no «${p.nombre}». Abortando.`)
    if (!m.is_active) throw new Error(`${p.nombre} está inactivo/a. Abortando.`)

    const { data: previos, error: ep } = await sb.from('volunteers').select('position_id').eq('member_id', m.id).eq('status', 'active')
    if (ep) throw ep
    const ids = (previos ?? []).map(v => v.position_id)
    const { data: puestos, error: eq } = ids.length
      ? await sb.from('service_positions').select('id, title, area_id').in('id', ids) : { data: [], error: null }
    if (eq) throw eq
    const areaIds = [...new Set((puestos ?? []).map(x => x.area_id))]
    const { data: areas } = areaIds.length ? await sb.from('areas').select('id, name').in('id', areaIds) : { data: [] }
    const nombreArea = new Map((areas ?? []).map(a => [a.id, a.name]))
    const lista = (puestos ?? []).map(x => `${x.title} @ ${nombreArea.get(x.area_id) ?? '?'}`)

    if (!aplicar || !positionId) {
      console.log(`  [simulacro] ${p.nombre} → ${TITULO}; conserva: ${lista.join(' | ') || '(ninguno)'}`)
      continue
    }
    await assignVolunteer(positionId, m.id)
    const { data: rolesAhora } = await sb.from('member_roles').select('role, origen').eq('member_id', m.id)
    console.log(`  ✓ ${p.nombre} → ${TITULO}`)
    console.log(`      conserva: ${lista.join(' | ') || '(ninguno)'}`)
    console.log(`      roles ahora: ${(rolesAhora ?? []).map(r => `${r.role} (${r.origen})`).join(', ')}`)
  }
  if (!aplicar) console.log('\nSimulacro. Volvé a correrlo con --aplicar para escribir.')
}

main().catch(e => { console.error(e); process.exit(1) })
