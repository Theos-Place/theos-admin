/**
 * Borra la cuenta de Auth que quedó huérfana al fusionar las dos fichas de
 * Hellen Galeano: el correo con DOS eles (galleanohellen31@gmail.com) ya no
 * apunta a ninguna ficha.
 *
 * Por qué no se deja ahí: getAuthContext resuelve la ficha por auth_user_id.
 * Una cuenta viva sin ficha significa que si algún día entra por ese correo,
 * entra SIN PERFIL — el mismo bug AUTH-2 que se arregló el 2026-09-10.
 *
 * Chequea antes de borrar: que nadie la use como auth_user_id y que nunca se
 * haya usado para entrar.
 */
import { createAdminClient } from '../../src/lib/supabase/admin'

const CORREO = 'galleanohellen31@gmail.com'
const aplicar = process.argv.includes('--aplicar')

async function main() {
  const sb = createAdminClient()
  let auth: { id: string; email: string; last_sign_in_at: string | null } | null = null
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const u = (data?.users ?? []).find(x => x.email?.toLowerCase() === CORREO)
    if (u) { auth = { id: u.id, email: u.email!, last_sign_in_at: u.last_sign_in_at ?? null }; break }
    if ((data?.users ?? []).length < 1000) break
  }
  if (!auth) { console.log('No existe esa cuenta de Auth. Nada que hacer.'); return }
  console.log('cuenta:', auth.id, '|', auth.email, '| último ingreso:', auth.last_sign_in_at ?? 'nunca')

  const { data: ficha } = await sb.from('members')
    .select('id, first_name, last_name').eq('auth_user_id', auth.id).maybeSingle()
  if (ficha) {
    throw new Error(`ABORTA: la cuenta SÍ tiene ficha (${JSON.stringify(ficha)}). Borrarla dejaría a esa persona sin acceso.`)
  }
  console.log('✓ no hay ninguna ficha apuntando a esta cuenta')
  if (auth.last_sign_in_at) {
    throw new Error('ABORTA: alguien entró con esta cuenta. Eso hay que mirarlo antes de borrar.')
  }
  console.log('✓ nunca se usó para entrar')

  if (!aplicar) { console.log('\nSimulacro. Volvé a correrlo con --aplicar.'); return }
  const { error } = await sb.auth.admin.deleteUser(auth.id)
  if (error) throw error
  console.log('✓ cuenta borrada')
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
