import { createAdminClient } from '../../src/lib/supabase/admin'
const JULIA = '9f228e37-37ec-4fce-8e6b-9c3079055fb4'
async function main() {
  const sb = createAdminClient()
  const detalle = async (id: string, etiqueta: string) => {
    const { data } = await sb.from('members')
      .select('id, first_name, last_name, email, phone, cedula, document_type, birth_date, gender, is_active, auth_user_id, created_at')
      .eq('id', id).maybeSingle()
    console.log(`\n══ ${etiqueta}`)
    console.log(JSON.stringify(data, null, 1))
    if (!data) return null
    const m = data as Record<string, unknown>
    const { data: fam } = await sb.from('family_members').select('family_unit_id, relation').eq('member_id', id)
    console.log('   familia:', JSON.stringify(fam))
    const { count: enr } = await sb.from('study_enrollments').select('id', { count: 'exact', head: true }).eq('member_id', id)
    const { count: chk } = await sb.from('event_checkins').select('id', { count: 'exact', head: true }).eq('member_id', id)
    const { count: pag } = await sb.from('payments').select('id', { count: 'exact', head: true }).eq('member_id', id)
    console.log(`   estudios: ${enr} · check-ins: ${chk} · pagos: ${pag}`)
    if (m.auth_user_id) {
      const { data: u } = await sb.auth.admin.getUserById(m.auth_user_id as string)
      console.log(`   cuenta: ${u.user?.email} · último ingreso ${u.user?.last_sign_in_at ?? 'nunca'}`)
    }
    return m
  }
  await detalle(JULIA, 'Julia Barrantes Soto (la hija)')

  console.log('\n══ ¿existe Natalia Soto Ocampo como ficha?')
  const { data: nat } = await sb.from('members')
    .select('id, first_name, last_name, email, cedula, auth_user_id').ilike('first_name', '%natalia%')
  for (const m of (nat ?? []) as Record<string,unknown>[]) {
    if (/soto/i.test(String(m.last_name))) console.log('   ', JSON.stringify(m))
  }
  console.log('\n══ ¿quién más tiene esa cédula?')
  const { data: julia } = await sb.from('members').select('cedula').eq('id', JULIA).single()
  const ced = (julia as {cedula:string|null}).cedula
  if (ced) {
    const { data: mismos } = await sb.from('members').select('id, first_name, last_name, cedula').eq('cedula', ced)
    console.log('   cédula', ced, '→', JSON.stringify(mismos))
  } else console.log('   Julia no tiene cédula')
}
main().catch(e => { console.error(e); process.exit(1) })
