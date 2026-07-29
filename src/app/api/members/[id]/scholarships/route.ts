import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, canViewMemberProfile } from '@/lib/auth/guard'
import { getMemberScholarships } from '@/lib/supabase/queries/scholarships'
import { isUuid } from '@/lib/validate'

// GET: becas ASIGNADAS de un miembro (kind 'asignada'; las genéricas con
// código no se listan) — PAG-4, sección "Mis becas" de /mis-pagos. Lo ve el
// propio miembro, su FAMILIA (mismo criterio que sus pagos) o el staff de
// becas/finanzas/dirección/admin. Solo lectura.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    const isStaff = auth.ctx.roles.some(r => ['admin', 'direccion', 'finanzas', 'becas'].includes(r))
    if (!isStaff && !(await canViewMemberProfile(auth.ctx, id))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    return NextResponse.json({ items: await getMemberScholarships(id) })
  } catch (error) {
    console.error('GET /api/members/[id]/scholarships:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
