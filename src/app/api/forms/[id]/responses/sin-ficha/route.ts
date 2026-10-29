import { NextRequest, NextResponse } from 'next/server'
import { requireRespuestasDelFormulario } from '@/lib/auth/respuestas-guard'
import { respuestasSinFicha } from '@/lib/supabase/queries/forms'
import { reportarError } from '@/lib/observabilidad'

// FRM-9 · GET: las respuestas que llegaron sin ficha, con su candidato del padrón.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const auth = await requireRespuestasDelFormulario(id)
    if (auth.res) return auth.res
    return NextResponse.json({ items: await respuestasSinFicha(id) })
  } catch (error) {
    reportarError('GET /api/forms/[id]/responses/sin-ficha:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
