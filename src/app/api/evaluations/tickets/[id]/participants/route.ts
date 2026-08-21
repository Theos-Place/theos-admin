import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { EVALUATION_ROLES } from '@/lib/auth/roles'
import {
  getEvaluationTicket, getEvaluationParticipants,
} from '@/lib/supabase/queries/evaluation-tickets'

// GET: quiénes contestaron la evaluación de este grupo y quiénes no.
//
// Endpoint aparte del compilado A PROPÓSITO: los nombres y las respuestas nunca
// viajan en el mismo payload. Saber a quién hay que recordarle es gestión; saber
// qué contestó cada quien rompería el anonimato del que depende todo esto.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(...EVALUATION_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const ticket = await getEvaluationTicket(id)
    if (!ticket) return NextResponse.json({ error: 'No existe ese tiquete' }, { status: 404 })
    return NextResponse.json(await getEvaluationParticipants(ticket.group_id))
  } catch (error) {
    console.error('GET /api/evaluations/tickets/[id]/participants:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
