import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRespuestasDelFormulario } from '@/lib/auth/respuestas-guard'
import { crearFichaDesdeRespuesta, FichaDuplicadaError, RespuestaNoVinculableError } from '@/lib/supabase/queries/forms'
import { isUuid } from '@/lib/validate'
import { reportarError } from '@/lib/observabilidad'

const bodySchema = z.object({
  first_name: z.string().trim().min(1),
  last_name: z.string().trim().min(1),
}).strict()

// EVE-14 · POST: crea la ficha desde una respuesta sin ficha y la vincula.
// Misma puerta que leer las respuestas. Sin correos. 409 con la ficha si el
// correo ya es de alguien (entonces se vincula a esa).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; responseId: string }> }) {
  try {
    const { id, responseId } = await params
    const auth = await requireRespuestasDelFormulario(id)
    if (auth.res) return auth.res
    if (!isUuid(responseId)) return NextResponse.json({ error: 'Respuesta no encontrada' }, { status: 404 })
    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    }
    const res = await crearFichaDesdeRespuesta(id, responseId, parsed.data, auth.ctx.userId)
    return NextResponse.json({ ok: true, ...res }, { status: 201 })
  } catch (error) {
    if (error instanceof FichaDuplicadaError) {
      return NextResponse.json({ error: error.message, code: 'duplicate', member: error.member }, { status: 409 })
    }
    if (error instanceof RespuestaNoVinculableError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    reportarError('POST /api/forms/[id]/responses/[responseId]/crear-ficha:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
