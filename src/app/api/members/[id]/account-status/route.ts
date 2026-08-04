import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { isUuid } from '@/lib/validate'
import { createAdminClient } from '@/lib/supabase/admin'
import { accountState, type AccountState } from '@/lib/members/account-state'

export type { AccountState }
export type AccountStatus = {
  state: AccountState
  linked: boolean
  email: string | null
  email_confirmed_at: string | null
  last_sign_in_at: string | null
}

// Estado de la cuenta de acceso (Supabase Auth) de un miembro. SOLO roles
// administrativos. Lee el usuario de Auth ligado vía members.auth_user_id con
// service_role (auth.admin.getUserById) — nunca en el cliente.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(...STUDY_ADMIN_ROLES)
  if (auth.res) return auth.res
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
  try {
    const supabase = createAdminClient()
    const { data: member } = await supabase.from('members').select('auth_user_id, email').eq('id', id).maybeSingle()
    const authUserId = (member as { auth_user_id: string | null } | null)?.auth_user_id ?? null
    const memberEmail = (member as { email: string | null } | null)?.email ?? null

    // Sin usuario de Auth ligado → no tiene cuenta de acceso.
    if (!authUserId) {
      return NextResponse.json({ state: 'none', linked: false, email: memberEmail, email_confirmed_at: null, last_sign_in_at: null } satisfies AccountStatus)
    }

    const { data, error } = await supabase.auth.admin.getUserById(authUserId)
    if (error || !data?.user) {
      // El link existe pero el usuario no se pudo leer (borrado en Auth, etc.).
      return NextResponse.json({ state: 'none', linked: false, email: memberEmail, email_confirmed_at: null, last_sign_in_at: null } satisfies AccountStatus)
    }
    const u = data.user
    // 'active' = ya entró al menos una vez. Tener usuario creado (AUTH-1 los
    // creó a todos) o el correo confirmado NO alcanza: quién nunca ha entrado
    // es la métrica de adopción. Ver src/lib/members/account-state.ts.
    return NextResponse.json({
      state: accountState({ authUserId, lastSignInAt: u.last_sign_in_at ?? null }),
      linked: true,
      email: u.email ?? memberEmail,
      email_confirmed_at: u.email_confirmed_at ?? null,
      last_sign_in_at: u.last_sign_in_at ?? null,
    } satisfies AccountStatus)
  } catch (error) {
    console.error('GET /api/members/[id]/account-status:', error)
    return NextResponse.json({ error: 'No se pudo consultar el estado de la cuenta.' }, { status: 500 })
  }
}
