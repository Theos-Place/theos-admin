/**
 * Los check-ins ya marcados como SERVIDOR: ¿siguen calificando ahora que las
 * charlas tienen comité organizador?
 *
 * Se registraron cuando el evento no tenía comité, o sea por el hueco que
 * arregló SRV-1: en ese momento el sistema decía que sí a cualquiera.
 */
import { createAdminClient } from '../../src/lib/supabase/admin'
import { calificaComoServidor } from '../../src/lib/supabase/queries/events'

const aplicar = process.argv.includes('--aplicar')

async function main() {
  const sb = createAdminClient()
  const { data: ev } = await sb.from('events').select('id, title').ilike('title', 'Charla%').gte('starts_at', '2026-09-01')
  const titulo = new Map((ev ?? []).map(e => [(e as {id:string}).id, (e as {title:string}).title]))
  const { data: ch } = await sb.from('event_checkins')
    .select('id, event_id, member_id, checked_in_as').in('event_id', [...titulo.keys()]).eq('checked_in_as', 'servidor')

  const aCorregir: string[] = []
  for (const c of (ch ?? []) as { id: string; event_id: string; member_id: string | null }[]) {
    const { data: m } = c.member_id
      ? await sb.from('members').select('first_name, last_name').eq('id', c.member_id).maybeSingle()
      : { data: null }
    const nombre = m ? `${(m as {first_name:string}).first_name} ${(m as {last_name:string}).last_name}` : '(invitado)'
    const califica = await calificaComoServidor(c.member_id, c.event_id)
    // No basta con "no sirve en el comité de ESTA sede": alguien puede servir
    // en la charla por otro comité (Javier Dávila es Producción Técnica
    // Antares y sí está sirviendo ahí). Solo se corrige a quien no sirve en
    // NINGÚN comité: ese no es servidor de nada.
    let sirveEnAlguno = false
    if (!califica && c.member_id) {
      const { data: vs } = await sb.from('volunteers')
        .select('id').eq('member_id', c.member_id).eq('status', 'active').limit(1)
      sirveEnAlguno = (vs ?? []).length > 0
    }
    const marca = califica ? '  ✓' : sirveEnAlguno ? '  ~' : '  ✗'
    const nota = califica ? '' : sirveEnAlguno ? '  ← sirve, pero por otro comité: se deja' : '  ← no sirve en ningún comité'
    console.log(`${marca} ${nombre.padEnd(32)} | ${titulo.get(c.event_id)}${nota}`)
    if (!califica && !sirveEnAlguno) aCorregir.push(c.id)
  }
  console.log(`\n${(ch ?? []).length} marcados como servidor · ${aCorregir.length} no sirven en NINGÚN comité`)
  if (!aCorregir.length) { console.log('Nada que corregir: los que están marcados sí sirven ahí.'); return }
  if (!aplicar) { console.log('\nSimulacro. Con --aplicar pasan a asistente (NO se les quita el check-in).'); return }
  const { error } = await sb.from('event_checkins').update({ checked_in_as: 'asistente' }).in('id', aCorregir)
  console.log(error ? `✗ ${error.message}` : `✓ ${aCorregir.length} pasaron a asistente; su asistencia queda intacta`)
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
