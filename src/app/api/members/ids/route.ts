import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getMemberIds } from '@/lib/supabase/queries/members'

// GET: solo los IDs (y total) que coinciden con los filtros, sin paginar.
// Mismos params que /api/members. Para guardar listas / acciones sobre todo el filtro.
export async function GET(req: NextRequest) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const { searchParams } = req.nextUrl
    const search    = searchParams.get('search')   ?? undefined
    const is_active = searchParams.get('is_active')
    const is_donor  = searchParams.get('is_donor')
    const is_server = searchParams.get('is_server')
    const active_attendance = searchParams.get('active_attendance')

    const result = await getMemberIds({
      search,
      is_active: is_active !== null ? is_active === 'true' : true,
      is_donor:  is_donor  !== null ? is_donor  === 'true' : undefined,
      is_server: is_server === 'true' ? true : undefined,
      active_attendance: active_attendance === 'true' ? true : undefined,
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/members/ids:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
