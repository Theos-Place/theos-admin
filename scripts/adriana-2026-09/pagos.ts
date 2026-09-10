import { createAdminClient } from '../../src/lib/supabase/admin'
const ELLA = 'a729c17a-d79c-4936-8a93-599e3926af27'
async function main() {
  const sb = createAdminClient()
  const { data: pagos } = await sb.from('payments').select('*').eq('member_id', ELLA).order('created_at')
  for (const p of (pagos ?? []) as Record<string, unknown>[]) {
    console.log('\n───', p.id)
    for (const [k, v] of Object.entries(p)) if (v !== null && v !== '') console.log(`   ${k}: ${JSON.stringify(v)}`)
  }
  console.log('\n═══ inscripciones (sin filtro de estado)')
  const { data: enr, error } = await sb.from('study_enrollments').select('*').eq('member_id', ELLA)
  console.log('error:', error?.message ?? 'ninguno', '| filas:', (enr ?? []).length)
  console.log(JSON.stringify(enr, null, 1))
}
main().catch(e => { console.error(e); process.exit(1) })
