/** Corre el detector contra producción. Solo lee. */
import { createAdminClient } from '../../src/lib/supabase/admin'
import { cuentasSinFicha, textoDelAviso, type FichaConCorreo } from '../../src/lib/auth/cuentas-sin-ficha'

async function main() {
  const sb = createAdminClient()
  const cuentas: Array<{ id: string; email: string }> = []
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const users = data?.users ?? []
    for (const u of users) if (u.email) cuentas.push({ id: u.id, email: u.email })
    if (users.length < 1000) break
  }
  const fichas: FichaConCorreo[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('members')
      .select('id, first_name, last_name, email, auth_user_id').not('email', 'is', null).range(from, from + 999)
    if (error) throw error
    const filas = (data ?? []) as Array<{ id: string; first_name: string|null; last_name: string|null; email: string; auth_user_id: string|null }>
    for (const m of filas) fichas.push({ id: m.id, nombre: `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim(), email: m.email, auth_user_id: m.auth_user_id })
    if (filas.length < 1000) break
  }
  console.log(`revisadas ${cuentas.length} cuentas contra ${fichas.length} fichas con correo\n`)
  const casos = cuentasSinFicha(cuentas, fichas)
  console.log(textoDelAviso(casos) ?? 'Nadie entra sin perfil.')
  for (const c of casos) {
    console.log(`\n· ${c.email} [${c.causa}]`)
    console.log(`  fichas: ${c.fichas.map(f => f.nombre).join(' | ')}`)
    console.log(`  ${c.quehacer}`)
  }
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
