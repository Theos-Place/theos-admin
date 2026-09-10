/**
 * Cada charla recurrente con el comité de SU sede como organizador.
 *
 * Sin comité organizador nadie califica como servidor — y antes del arreglo de
 * SRV-1 (2026-09-10) calificaba CUALQUIERA, porque memberServesAnyCommittee es
 * permisivo con la lista vacía. Así que esto no es cosmético: es lo que hace
 * que el conteo de servidores signifique algo.
 *
 *   ... scripts/charlas-2026-09/ligar-comites.ts            (simulacro)
 *   ... scripts/charlas-2026-09/ligar-comites.ts --aplicar
 */
import { createAdminClient } from '../../src/lib/supabase/admin'
const aplicar = process.argv.includes('--aplicar')

async function main() {
  const sb = createAdminClient()
  const { data: areas } = await sb.from('areas').select('id, name, area_type')
  const comitePorNombre = new Map(
    ((areas ?? []) as { id: string; name: string; area_type: string | null }[])
      .filter(a => a.area_type === 'committee')
      .map(a => [a.name.trim().toLowerCase(), a.id]),
  )
  const { data: sedes } = await sb.from('sedes').select('id, name')
  const nombreSede = new Map((sedes ?? []).map(s => [(s as {id:string}).id, (s as {name:string}).name]))

  const { data: ev } = await sb.from('events')
    .select('id, title, sede_id').ilike('title', 'Charla%').gte('starts_at', '2026-09-01').order('title')

  let listas = 0, sinSede = 0, sinComite = 0, aLigar: Array<[string, string, string]> = []
  for (const e of (ev ?? []) as { id: string; title: string; sede_id: string | null }[]) {
    const { data: ya } = await sb.from('event_organizing_committees')
      .select('committee_id').eq('event_id', e.id)
    if ((ya ?? []).length) { listas++; continue }
    const sede = e.sede_id ? nombreSede.get(e.sede_id) : null
    if (!sede) { console.log(`⚠️  ${e.title}: sin sede, no se puede deducir el comité`); sinSede++; continue }
    // El comité de sede se llama IGUAL que la sede. Se busca por nombre exacto
    // y no por parecido: "Sede Madrid" y "Sede Madrid Home" son distintas.
    const comite = comitePorNombre.get(sede.trim().toLowerCase())
    if (!comite) { console.log(`⚠️  ${e.title}: no hay comité llamado «${sede}»`); sinComite++; continue }
    aLigar.push([e.id, comite, `${e.title} → ${sede}`])
  }

  console.log(`\n${listas} ya tenían · ${aLigar.length} por ligar · ${sinSede} sin sede · ${sinComite} sin comité que calce`)
  for (const [, , etiqueta] of aLigar) console.log('   ', etiqueta)

  if (!aplicar) { console.log('\nSimulacro. Volvé a correrlo con --aplicar.'); return }
  for (const [eventId, committeeId, etiqueta] of aLigar) {
    const { error } = await sb.from('event_organizing_committees').insert({ event_id: eventId, committee_id: committeeId })
    console.log(error ? `   ✗ ${etiqueta}: ${error.message}` : `   ✓ ${etiqueta}`)
  }
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
