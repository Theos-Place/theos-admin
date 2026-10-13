import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { PREMAT_EVAL_ROLES } from '@/lib/studies/premat-evaluation'
import { getCierrePrematrimonial } from '@/lib/supabase/queries/prematrimonial'
import { isUuid } from '@/lib/validate'
import { reportarError } from '@/lib/observabilidad'

/**
 * GET · PRE-9 · UN cierre completo, con el contenido pastoral.
 *
 * Acá sí viajan el punto ciego, las observaciones y la bendición. Es una
 * llamada por cierre a propósito: que leer esto sea un acto deliberado y no
 * algo que aparece de refilón en una lista.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles(...PREMAT_EVAL_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Cierre no encontrado' }, { status: 404 })
    const cierre = await getCierrePrematrimonial(id)
    if (!cierre) return NextResponse.json({ error: 'Cierre no encontrado' }, { status: 404 })
    return NextResponse.json(cierre)
  } catch (error) {
    reportarError('GET /api/studies/prematrimonial/cierres/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
