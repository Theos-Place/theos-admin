import { NextRequest, NextResponse } from 'next/server'
import { requireRespuestasDelFormulario } from '@/lib/auth/respuestas-guard'
import { vincularRespuestaSinFicha, RespuestaNoVinculableError } from '@/lib/supabase/queries/forms'
import { isUuid } from '@/lib/validate'
import { reportarError } from '@/lib/observabilidad'

// FRM-9 · PATCH: liga una respuesta sin ficha a una persona. Body: { member_id }.
// Misma puerta que leer las respuestas: quien las ve puede corregir a quién
// pertenecen. Si el formulario inscribe a un evento, crea la inscripción.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; responseId: string }> }) {
  try {
    const { id, responseId } = await params
    const auth = await requireRespuestasDelFormulario(id)
    if (auth.res) return auth.res
    const body = await req.json().catch(() => null)
    const memberId = typeof body?.member_id === 'string' ? body.member_id : ''
    if (!isUuid(responseId) || !isUuid(memberId)) {
      return NextResponse.json({ error: 'Se requiere member_id válido' }, { status: 400 })
    }
    const res = await vincularRespuestaSinFicha(id, responseId, memberId, auth.ctx.userId)
    return NextResponse.json({ ok: true, ...res })
  } catch (error) {
    if (error instanceof RespuestaNoVinculableError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    reportarError('PATCH /api/forms/[id]/responses/[responseId]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
