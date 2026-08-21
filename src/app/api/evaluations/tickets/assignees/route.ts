import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { EVALUATION_ROLES } from '@/lib/auth/roles'
import { getAssignableEvaluationMembers } from '@/lib/supabase/queries/evaluation-tickets'

// GET: a quién se le puede asignar un tiquete de evaluación.
export async function GET() {
  const auth = await requireRoles(...EVALUATION_ROLES)
  if (auth.res) return auth.res
  try {
    return NextResponse.json(await getAssignableEvaluationMembers())
  } catch (error) {
    console.error('GET /api/evaluations/tickets/assignees:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
