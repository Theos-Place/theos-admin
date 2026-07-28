import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { verifyConfig } from '@/lib/supabase/queries/communications'

// POST: marca la config como verificada.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('admin') // COM-1: configuración solo admin
    if (auth.res) return auth.res
  try {
    const { id } = await params
    await verifyConfig(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/communications/configs/[id]/verify:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
