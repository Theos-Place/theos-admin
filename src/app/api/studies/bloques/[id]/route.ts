import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateBloque, deleteBloque, countBlockEnrollments } from '@/lib/supabase/queries/bloques'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function loose() {
  return createAdminClient() as unknown as import('@supabase/supabase-js').SupabaseClient
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles('coordinador_estudios', 'admin')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const body = (await req.json()) as Record<string, unknown>

    // Allowlist: el body crudo podía setear cualquier columna (estado,
    // *_sent_at → re-disparo de hitos). Solo estos campos son editables.
    const patch: { nombre?: string; anio?: number; fecha_apertura?: string; fecha_cierre_matricula?: string } = {}
    if (typeof body.nombre === 'string' && body.nombre.trim()) patch.nombre = body.nombre.trim()
    if (body.anio !== undefined) {
      const anio = Number(body.anio)
      if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
        return NextResponse.json({ error: 'Año inválido' }, { status: 400 })
      }
      patch.anio = anio
    }
    for (const k of ['fecha_apertura', 'fecha_cierre_matricula'] as const) {
      if (body[k] !== undefined) {
        if (typeof body[k] !== 'string' || !ISO_DATE.test(body[k] as string)) {
          return NextResponse.json({ error: `${k} debe ser una fecha YYYY-MM-DD` }, { status: 400 })
        }
        patch[k] = body[k] as string
      }
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
    }

    // Validar el par de fechas RESULTANTE (patch parcial se combina con lo
    // guardado) y pasar ambas para que el estado derivado se recalcule.
    const { data: cur } = await loose()
      .from('capacitacion_bloques')
      .select('fecha_apertura, fecha_cierre_matricula')
      .eq('id', id).maybeSingle()
    if (!cur) return NextResponse.json({ error: 'Bloque no encontrado' }, { status: 404 })
    const current = cur as { fecha_apertura: string; fecha_cierre_matricula: string }
    const apertura = patch.fecha_apertura ?? current.fecha_apertura
    const cierre = patch.fecha_cierre_matricula ?? current.fecha_cierre_matricula
    if (cierre < apertura) {
      return NextResponse.json(
        { error: 'La fecha de cierre de matrícula no puede ser anterior a la apertura.' },
        { status: 400 },
      )
    }
    if (patch.fecha_apertura || patch.fecha_cierre_matricula) {
      patch.fecha_apertura = apertura
      patch.fecha_cierre_matricula = cierre
    }

    await updateBloque(id, patch)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/studies/bloques/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE: ?check=1 devuelve cuántas matrículas asociadas tiene (para que la UI
// advierta). El borrado real TAMBIÉN valida server-side: un bloque con
// matrículas no se borra (se archiva) — la regla no puede vivir solo en el cliente.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles('coordinador_estudios', 'admin')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const { data } = await loose()
      .from('capacitacion_bloques').select('fecha_apertura').eq('id', id).maybeSingle()
    const apertura = (data as { fecha_apertura: string } | null)?.fecha_apertura ?? null
    const enrollments = apertura ? await countBlockEnrollments(apertura) : 0

    if (req.nextUrl.searchParams.get('check') === '1') {
      return NextResponse.json({ enrollments })
    }
    if (enrollments > 0) {
      return NextResponse.json(
        { error: `El bloque tiene ${enrollments} matrícula(s) asociadas; archivalo en vez de borrarlo.` },
        { status: 409 },
      )
    }
    await deleteBloque(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/studies/bloques/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
