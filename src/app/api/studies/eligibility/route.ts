import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validate'
import { getEligibleStudiesForMember } from '@/lib/supabase/queries/studies'

// GET ?member_id=X — elegibilidad de estudios del miembro para los modales de
// solicitud. El propio perfil siempre; el de OTRO miembro exige módulo estudios
// o padrón (devuelve is_donor/historial — datos que un usuario base no debe
// poder consultar de terceros).
export async function GET(req: NextRequest) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const memberId = req.nextUrl.searchParams.get('member_id')
    if (!memberId || !isUuid(memberId)) {
      return NextResponse.json({ error: 'Se requiere member_id válido' }, { status: 400 })
    }
    if (memberId !== auth.ctx.memberId) {
      const estudios = await requireModuleView('estudios', { beyondOwn: true })
      if (estudios.res) {
        const miembros = await requireModuleView('miembros', { beyondOwn: true })
        if (miembros.res) return miembros.res
      }
    }
    return NextResponse.json(await getEligibleStudiesForMember(memberId))
  } catch (error) {
    console.error('GET /api/studies/eligibility:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
