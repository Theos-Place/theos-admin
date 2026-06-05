import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { RoleId } from '@/types/auth'

/**
 * Devuelve el usuario autenticado actual con sus roles activos.
 * Forma compatible con el hook de auth del cliente.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    // El member y los roles se leen con service role (RLS aún no está activo
    // en el data layer — ver Fase 3).
    const admin = createAdminClient()

    const { data: member } = await admin
      .from('members')
      .select('id, first_name, last_name, email')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!member) {
      // Usuario de auth sin member enlazado: sin acceso a módulos.
      return NextResponse.json({
        user: { name: user.email ?? '', email: user.email ?? '', roles: [], role: null, member_id: null },
      })
    }

    const { data: roleRows } = await admin
      .from('member_roles')
      .select('role')
      .eq('member_id', member.id)
      .eq('is_active', true)

    // Regla de negocio: todo usuario autenticado con member enlazado es 'miembro'
    // por defecto (solo ve su propio perfil) si no tiene otros roles activos.
    const explicitRoles = (roleRows ?? []).map(r => r.role as RoleId)
    const roles: RoleId[] = explicitRoles.length ? explicitRoles : ['miembro']
    const name = `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim() || (member.email ?? '')

    return NextResponse.json({
      user: {
        name,
        email: member.email ?? user.email ?? '',
        roles,
        role: roles[0] ?? null,
        member_id: member.id,
      },
    })
  } catch (error) {
    console.error('GET /api/auth/me:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
