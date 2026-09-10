/** El MISMO código del endpoint /api/auth/password-link, línea por línea. */
import { createAdminClient } from '../../src/lib/supabase/admin'
import { patronDeCorreo } from '../../src/lib/email/correo-exacto'

async function main() {
  for (const escrito of ['lisavaldiviezo@hotmail.com', 'LisaValdiviezo@Hotmail.com', ' lisavaldiviezo@hotmail.com ']) {
    const identifier = escrito.trim().toLowerCase()
    const supabase = createAdminClient()
    const esCorreo = identifier.includes('@')
    const query = supabase.from('members').select('first_name, email, auth_user_id').limit(1)
    const { data, error } = esCorreo
      ? await query.ilike('email', patronDeCorreo(identifier))
      : await query.eq('cedula_normalized', identifier.replace(/[\s-]/g, '').toUpperCase())
    const member = (data ?? [])[0] as { first_name: string | null; email: string | null } | undefined
    const email = member?.email?.trim()
    console.log(`escrito ${JSON.stringify(escrito)}`)
    console.log(`   patrón: ${JSON.stringify(patronDeCorreo(identifier))}`)
    console.log(`   error: ${error?.message ?? 'ninguno'} | filas: ${(data ?? []).length} | resultado: ${email ? 'ENCUENTRA a ' + member?.first_name : 'NO ENCUENTRA → registra "sin miembro"'}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
