import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { PREMAT_EVAL_ROLES } from '@/lib/studies/premat-evaluation'
import { getPrematEvaluations } from '@/lib/supabase/queries/prematrimonial'
import { isUuid } from '@/lib/validate'

// GET: evaluaciones de pareja del prematrimonial (?request_id= o ?member_id=).
// PRE-8 — SENSIBLE: contenido pastoral (puntos ciegos, temas no resueltos).
// Gate ESTRECHO: coordinador_estudios / direccion / admin. NO lo ve el propio
// miembro ni su pareja (la tabla tiene RLS sin policies: solo service role),
// ni coordinador_dirigentes (que sí puede cerrar grupos).
export async function GET(req: NextRequest) {
  const auth = await requireRoles(...PREMAT_EVAL_ROLES)
  if (auth.res) return auth.res
  try {
    const { searchParams } = req.nextUrl
    const requestId = searchParams.get('request_id')
    const memberId = searchParams.get('member_id')
    if (!requestId && !memberId) {
      return NextResponse.json({ error: 'Se requiere request_id o member_id' }, { status: 400 })
    }
    if (requestId && !isUuid(requestId)) return NextResponse.json({ error: 'request_id inválido' }, { status: 400 })
    if (memberId && !isUuid(memberId)) return NextResponse.json({ error: 'member_id inválido' }, { status: 400 })
    const items = await getPrematEvaluations({
      requestIds: requestId ? [requestId] : undefined,
      memberId: memberId ?? undefined,
    })
    return NextResponse.json({ items })
  } catch (error) {
    console.error('GET /api/studies/prematrimonial/evaluations:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
