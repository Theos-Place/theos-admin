/** SOLO LECTURA: el dry-run del barrido con los datos de hoy. */
import { expirePendingStudyEnrollments, avisarMatriculasPorVencer } from '@/lib/supabase/queries/studies'
async function main() {
  const [exp, avi] = await Promise.all([
    expirePendingStudyEnrollments(new Date(), { dryRun: true }),
    avisarMatriculasPorVencer(new Date(), { dryRun: true }),
  ])
  console.log(`=== soltaría el cupo (${exp.detalle.length}) ===`)
  exp.detalle.forEach(d => console.log(`  ${d.nombre ?? d.member_id} · ${d.grupo ?? d.group_id}`))
  if (!exp.detalle.length) console.log('  ninguna')
  console.log(`\n=== avisaría "te quedan 24 horas" (${avi.detalle.length}) ===`)
  avi.detalle.forEach(d => console.log(`  ${d.member_id} · ${d.grupo ?? '—'} · lleva ${d.horas}h`))
  if (!avi.detalle.length) console.log('  ninguna')
}
main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1) })
