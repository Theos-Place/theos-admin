import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { EVALUATION_ROLES } from '@/lib/auth/roles'
import { getEvaluationTickets } from '@/lib/supabase/queries/evaluation-tickets'
import type { EvaluationTicketStatus } from '@/types/evaluations'

const ESTADOS: EvaluationTicketStatus[] = ['open', 'in_review', 'escalated', 'resolved', 'rejected']

// GET: la cola de evaluaciones (DIR-5). Acceso acotado: rol evaluaciones,
// coordinador_dirigentes y admin. 'direccion' NO entra — ver EVALUATION_ROLES.
export async function GET(req: NextRequest) {
  const auth = await requireRoles(...EVALUATION_ROLES)
  if (auth.res) return auth.res
  try {
    const raw = req.nextUrl.searchParams.get('status')
    const status = ESTADOS.includes(raw as EvaluationTicketStatus)
      ? (raw as EvaluationTicketStatus)
      : undefined
    return NextResponse.json(await getEvaluationTickets({ status }))
  } catch (error) {
    console.error('GET /api/evaluations/tickets:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
