import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { normalizeRestriction, restrictionSummary } from '@/lib/audiencia/restriccion'
import { countMembersMatchingRestriction } from '@/lib/supabase/queries/audiencia'
import { reportarError } from '@/lib/observabilidad'

// Cuánta gente del padrón cumpliría esta restricción de audiencia.
//
// Es el número que se ve MIENTRAS se arma: una condición demasiado estrecha se
// nota ahí y no cuando ya nadie pudo entrar. POST porque la restricción es un
// objeto (conditions + groups + ops) y no cabe en la URL.
//
// Guard de sesión y no por módulo: lo consumen dos builders con dueños
// distintos (grupos de estudio y formularios) y la respuesta es un CONTEO del
// padrón sobre condiciones que el propio llamador acaba de escribir — no
// expone a nadie. Cada builder ya está detrás del permiso de su pantalla.
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const body = await req.json().catch(() => null)
    const restriction = normalizeRestriction((body as { restriction?: unknown } | null)?.restriction)
    const count = await countMembersMatchingRestriction(restriction)
    return NextResponse.json({ count, summary: restrictionSummary(restriction) })
  } catch (error) {
    reportarError('POST /api/audience/count:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
