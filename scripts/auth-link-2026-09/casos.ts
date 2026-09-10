import { createAdminClient } from '../../src/lib/supabase/admin'
const IDS = ['84ffe61d-2111-4e28-89c4-a6124cdf72cc', '9f228e37-37ec-4fce-8e6b-9c3079055fb4', '608ce0ea-0e99-4c70-b67c-392ef98cb273']
const CORREOS = ['samaracastillolaguna@gmail.com', 'nataliasotoocampo@gmail.com', 'vitos_78@hotmail.com']
async function main() {
  const s = createAdminClient()
  for (const c of CORREOS) {
    const { data, error } = await s.from('members').select('id, first_name, last_name, email, auth_user_id, is_active').eq('email', c)
    console.log('==', c, error?.message ?? '')
    for (const m of (data ?? []) as Record<string, unknown>[]) console.log('   ', m.first_name, m.last_name, '| activo:', m.is_active, '| auth:', m.auth_user_id, '|', m.id)
  }
  const { data: fichas, error: e2 } = await s.from('members').select('id, first_name, last_name, email, cedula, created_at').in('id', IDS)
  console.log('\nfichas:', e2?.message ?? '', JSON.stringify(fichas, null, 1))
}
main().catch(e => { console.error(e); process.exit(1) })
