/**
 * Alta idempotente de una cuenta de acceso (Supabase Auth + member + rol).
 *
 * Salió de seed-test-users.ts, que hacía exactamente esto para sus 13 usuarios
 * por rol. Lo comparten ese script y seed-datos-de-prueba.ts: el flujo de crear
 * el usuario, enlazarlo al miembro y asignarle el rol tiene varios pasos con
 * orden y idempotencia propios, y tenerlo dos veces es tenerlo mal una vez.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RoleId } from '../../src/types/auth'

type Admin = SupabaseClient<never, 'public', never>

/** Busca el usuario de Auth por correo (listUsers pagina; alcanza la 1.ª página
 *  con los volúmenes de prueba). */
export async function buscarAuthUserPorCorreo(
  admin: Admin, email: string,
): Promise<string | null> {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  return data?.users.find(u => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null
}

/**
 * Crea (o reutiliza) el usuario de Auth y lo deja enlazado al miembro con su rol.
 * `memberId` opcional: si no viene, se busca/crea el member por correo.
 * Devuelve el member_id, o null si algo falló (loguea el motivo).
 */
export async function crearCuentaDeAcceso(admin: Admin, input: {
  email: string
  password: string
  nombre: string
  role?: RoleId
  /** Si ya existe el miembro, su id — evita buscarlo por correo. */
  memberId?: string
  /** Campos extra al INSERTAR el member (external_id, phone…). Ignorado si ya existe. */
  camposMiembro?: Record<string, unknown>
}): Promise<string | null> {
  const { email, password, nombre, role, memberId, camposMiembro } = input

  // 1. Usuario de Auth (idempotente: si ya existe, se le repone la contraseña).
  let authId: string | null = null
  const creado = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (creado.data?.user) {
    authId = creado.data.user.id
  } else {
    authId = await buscarAuthUserPorCorreo(admin, email)
    if (authId) await admin.auth.admin.updateUserById(authId, { password })
  }
  if (!authId) {
    console.error(`  ✗ ${email}: no se pudo crear ni encontrar el usuario de auth`)
    return null
  }

  // 2. Member enlazado.
  let id = memberId ?? null
  if (!id) {
    const { data: existente } = await admin.from('members').select('id').eq('email', email).maybeSingle()
    id = (existente as { id: string } | null)?.id ?? null
  }
  if (id) {
    await admin.from('members').update({ auth_user_id: authId, is_active: true }).eq('id', id)
  } else {
    const [first, ...resto] = nombre.split(' ')
    const { data: ins, error } = await admin.from('members')
      .insert({
        first_name: first, last_name: resto.join(' ') || '·',
        email, is_active: true, auth_user_id: authId, ...camposMiembro,
      })
      .select('id').single()
    if (error || !ins) { console.error(`  ✗ ${email}: member ${error?.message}`); return null }
    id = (ins as { id: string }).id
  }

  // 3. Rol (idempotente).
  if (role) {
    const { data: fila } = await admin.from('member_roles')
      .select('id').eq('member_id', id).eq('role', role).maybeSingle()
    if (fila) await admin.from('member_roles').update({ is_active: true }).eq('id', (fila as { id: string }).id)
    else await admin.from('member_roles').insert({ member_id: id, role, is_active: true })
  }

  return id
}
