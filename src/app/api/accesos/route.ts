import { NextResponse } from 'next/server'
import { ACCESOS_SCREEN_ROLES } from '@/lib/auth/roles'
import { requireRoles } from '@/lib/auth/guard'
import { getUserAccess } from '@/lib/supabase/queries/members'

// GET: miembros con roles asignados (gestión de accesos). admin ve todo;
// coordinador_estudios entra para gestionar los permisos que tiene delegados.
export async function GET() {
  try {
    const auth = await requireRoles(...ACCESOS_SCREEN_ROLES)
    if (auth.res) return auth.res
    return NextResponse.json(await getUserAccess())
  } catch (error) {
    console.error('GET /api/accesos:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
