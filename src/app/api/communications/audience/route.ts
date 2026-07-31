import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import {
  getEligibleAudience, getCommitteeAudiences, type AudienceType,
} from '@/lib/supabase/queries/communications'

// GET: audiencia elegible (activos con email, sin baja/rebote/queja) para una
// campaña. Params: type=all|sede|servidonantes, sedes=code1,code2 (para 'sede').
// Devuelve { count, member_ids }.
export async function GET(req: NextRequest) {
  const auth = await requireRoles('comunicaciones', 'direccion')
  if (auth.res) return auth.res
  try {
    const sp = req.nextUrl.searchParams
    // ?facet=committees → comités activos con los ids de sus servidores, para el
    // selector de destinatarios (no expone datos de contacto).
    if (sp.get('facet') === 'committees') {
      return NextResponse.json({ committees: await getCommitteeAudiences() })
    }
    const typeParam = sp.get('type')
    const type: AudienceType = typeParam === 'sede' || typeParam === 'servidonantes' ? typeParam : 'all'
    const sedeCodes = (sp.get('sedes') ?? '').split(',').map(s => s.trim()).filter(Boolean)
    const result = await getEligibleAudience(type, sedeCodes)
    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/communications/audience:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
