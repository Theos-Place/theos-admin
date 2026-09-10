import { createAdminClient } from '../../src/lib/supabase/admin'
import { patronDeCorreo } from '../../src/lib/email/correo-exacto'
const CORREO = 'carlosgar_6@hotmail.com'
async function main() {
  const sb = createAdminClient()
  const { data: m } = await sb.from('members')
    .select('id, first_name, last_name, email, auth_user_id, is_active')
    .ilike('email', patronDeCorreo(CORREO))
  console.log('ficha:', JSON.stringify(m))
  const { data: logs } = await sb.from('message_logs')
    .select('created_at, subject, status, last_error').ilike('recipient', patronDeCorreo(CORREO))
    .order('created_at', { ascending: false }).limit(8)
  console.log(`\ncorreos que le salieron: ${(logs ?? []).length}`)
  for (const l of (logs ?? []) as Record<string,unknown>[]) {
    const cr = new Date(l.created_at as string).toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' })
    console.log(`   ${cr} | ${l.status} | ${String(l.subject).slice(0,50)} | ${l.last_error ?? ''}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
