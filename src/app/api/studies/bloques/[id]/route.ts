import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateBloque, deleteBloque, countBlockEnrollments } from '@/lib/supabase/queries/bloques'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles('coordinador_estudios', 'admin')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const patch = (await req.json()) as Record<string, unknown>
    await updateBloque(id, patch)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/studies/bloques/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE: ?check=1 devuelve cuántas matrículas asociadas tiene (regla de borrado).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles('coordinador_estudios', 'admin')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const supabase = createAdminClient()
    const { data } = await (supabase as unknown as import('@supabase/supabase-js').SupabaseClient)
      .from('capacitacion_bloques').select('fecha_apertura').eq('id', id).maybeSingle()
    const apertura = (data as { fecha_apertura: string } | null)?.fecha_apertura ?? null

    if (req.nextUrl.searchParams.get('check') === '1') {
      const enrollments = apertura ? await countBlockEnrollments(apertura) : 0
      return NextResponse.json({ enrollments })
    }
    await deleteBloque(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/studies/bloques/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
