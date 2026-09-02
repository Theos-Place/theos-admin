import { NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { getFolletoDetalle } from '@/lib/supabase/queries/folletos'

// GET: detalle de un tiquete de folletos — grupo, dirigentes, ubicación, sede
// de entrega, desglose de la cantidad y, si vino de un cierre, cómo terminó el
// grupo anterior. Módulo 'folletos'.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleView('folletos')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const detalle = await getFolletoDetalle(id)
    if (!detalle) return NextResponse.json({ error: 'Esa solicitud de folletos no existe.' }, { status: 404 })
    return NextResponse.json(detalle)
  } catch (error) {
    console.error('GET /api/studies/folletos/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
