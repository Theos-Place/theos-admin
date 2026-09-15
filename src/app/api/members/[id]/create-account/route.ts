import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { isUuid } from '@/lib/validate'
import { createAdminClient } from '@/lib/supabase/admin'
import { inviteMemberToCompleteProfile } from '@/lib/auth/invite'
import { puedeCrearseCuenta, MOTIVO_MENOR_SIN_CUENTA } from '@/lib/members/reglas-de-menores'

// Crea la cuenta de acceso (Supabase Auth) de un miembro y le envía las instrucciones
// de activación. SOLO roles administrativos, service_role en backend. Reutiliza
// inviteMemberToCompleteProfile (crea el usuario de Auth + enlaza auth_user_id).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(...STUDY_ADMIN_ROLES)
  if (auth.res) return auth.res
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
  try {
    const supabase = createAdminClient()
    const { data: member } = await supabase.from('members')
      .select('auth_user_id, email, birth_date, datos_protegidos').eq('id', id).maybeSingle()
    const m = member as {
      auth_user_id: string | null; email: string | null
      birth_date: string | null; datos_protegidos: boolean | null
    } | null
    const authUserId = m?.auth_user_id ?? null
    const email = m?.email?.trim() || null

    // FAM-2 · A un menor no se le crea cuenta. Acá y no solo escondiendo el
    // botón: el endpoint es alcanzable sin pasar por la ficha, y el script
    // masivo de cuentas entra por otro lado que también lo respeta.
    if (m && !puedeCrearseCuenta(m)) {
      return NextResponse.json({ error: MOTIVO_MENOR_SIN_CUENTA, code: 'menor_sin_cuenta' }, { status: 403 })
    }
    if (authUserId) return NextResponse.json({ error: 'Este miembro ya tiene cuenta de acceso.' }, { status: 400 })
    if (!email) return NextResponse.json({ error: 'El miembro no tiene correo registrado.' }, { status: 400 })

    const result = await inviteMemberToCompleteProfile(id, email)
    if (!result.sent) {
      return NextResponse.json({ error: result.reason || 'No se pudo crear la cuenta.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, email })
  } catch (error) {
    console.error('POST /api/members/[id]/create-account:', error)
    const msg = error instanceof Error ? error.message : 'No se pudo crear la cuenta.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
