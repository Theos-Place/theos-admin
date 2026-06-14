import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { getStudyDashboardStats } from '@/lib/supabase/queries/studies'

// Métricas del resumen de estudios (grupos + estudiantes por categoría y estado),
// calculadas en la BD. Solo roles de estudios/admin (usan service role → sin RLS).
export async function GET() {
  try {
    const auth = await requireRoles(...STUDY_ADMIN_ROLES)
    if (auth.res) return auth.res
    return NextResponse.json(await getStudyDashboardStats())
  } catch (error) {
    console.error('GET /api/studies/dashboard-stats:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
