import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { countBlockEnrollments } from '@/lib/supabase/queries/bloques'

// GET: cuántas matrículas asociadas tiene el bloque, para que la UI advierta
// antes de ofrecer el borrado. Reemplaza el viejo modo `DELETE ?check=1`
// (un retry sin el query param borraba de verdad). Mismo guard que el DELETE.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles('coordinador_estudios', 'admin')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const { data } = await (createAdminClient() as unknown as import('@supabase/supabase-js').SupabaseClient)
      .from('capacitacion_bloques').select('fecha_apertura').eq('id', id).maybeSingle()
    const apertura = (data as { fecha_apertura: string } | null)?.fecha_apertura ?? null
    const enrollments = apertura ? await countBlockEnrollments(apertura) : 0
    return NextResponse.json({ enrollments })
  } catch (error) {
    console.error('GET /api/studies/bloques/[id]/usage:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
