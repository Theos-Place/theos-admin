import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getUserAccess } from '@/lib/supabase/queries/members'

// GET: miembros con roles asignados (gestión de accesos).
export async function GET() {
  try {
    const auth = await requireRoles('admin')
    if (auth.res) return auth.res
    return NextResponse.json(await getUserAccess())
  } catch (error) {
    console.error('GET /api/accesos:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
