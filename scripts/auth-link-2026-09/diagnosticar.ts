/**
 * Miembros con cuenta de Auth pero auth_user_id null: al entrar quedarían sin perfil.
 */
import { createAdminClient } from '../../src/lib/supabase/admin'

async function main() {
  const s = createAdminClient()
  const porCorreo = new Map<string, { id: string; created_at: string; last_sign_in_at: string | null }>()
  let page = 1
  for (;;) {
    const { data, error } = await s.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const users = data?.users ?? []
    for (const u of users) if (u.email) porCorreo.set(u.email.toLowerCase(), { id: u.id, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at ?? null })
    if (users.length < 1000) break
    page++
  }
  console.log('usuarios auth:', porCorreo.size)

  const filas: { id: string; email: string; nombre: string; auth: string; creado: string; login: string | null }[] = []
  let from = 0
  for (;;) {
    const { data, error } = await s.from('members')
      .select('id, first_name, last_name, email, auth_user_id')
      .is('auth_user_id', null)
      .not('email', 'is', null)
      .range(from, from + 999)
    if (error) throw error
    const rows = (data ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string; auth_user_id: string | null }[]
    for (const m of rows) {
      const u = porCorreo.get(m.email.toLowerCase())
      if (u) filas.push({ id: m.id, email: m.email, nombre: `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim(), auth: u.id, creado: u.created_at, login: u.last_sign_in_at })
    }
    if (rows.length < 1000) break
    from += 1000
  }
  filas.sort((a, b) => a.creado.localeCompare(b.creado))
  console.log('miembros sin enlazar con cuenta existente:', filas.length)
  for (const f of filas) console.log([f.creado.slice(0, 16), f.login ? 'ENTRÓ ' + f.login.slice(0, 16) : 'nunca entró', f.nombre, f.email, f.id, f.auth].join(' | '))

  // ¿Ese auth_user_id ya lo tiene otro miembro?
  const ids = filas.map(f => f.auth)
  if (ids.length) {
    const { data: choques } = await s.from('members').select('id, first_name, last_name, auth_user_id').in('auth_user_id', ids)
    console.log('choques (auth_user_id ya usado por otra ficha):', (choques ?? []).length)
    for (const c of (choques ?? []) as { id: string; first_name: string|null; last_name: string|null; auth_user_id: string }[]) console.log('  ', c.auth_user_id, c.first_name, c.last_name, c.id)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
