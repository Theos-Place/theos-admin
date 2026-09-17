/** SOLO LECTURA: cómo queda el historial de Floriana con el arreglo. */
import { getMemberFullById } from '@/lib/supabase/queries/members'
import { diaCR } from '@/lib/events/checkins-del-dia'
async function main() {
  const m = await getMemberFullById('e139784e-30d9-4763-99a3-dd8e24fb22b6')
  const a = (m?.attendance ?? []).slice(0, 6)
  console.log(`asistencias en el historial (${m?.attendance?.length ?? 0}):`)
  a.forEach(x => console.log(`  ${diaCR(x.event_date)}  ${x.event_name}`))
  const dias = a.map(x => diaCR(x.event_date))
  console.log(dias.length === new Set(dias).size ? '\n>>> sin fechas repetidas' : '\n>>> HAY FECHAS REPETIDAS')
}
main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1) })
