import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { markScholarshipUsed, revokeScholarship } from '@/lib/supabase/queries/finance'

// PUT: marca la beca como usada.
export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('finanzas', 'direccion')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    await markScholarshipUsed(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/finance/scholarships/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE: revoca una beca sin usar (las usadas no se revocan: el descuento ya aplicó).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('finanzas', 'direccion')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    const revoked = await revokeScholarship(id)
    if (!revoked) {
      return NextResponse.json(
        { error: 'La beca no existe o ya fue usada (una beca aplicada no se puede revocar).' },
        { status: 409 },
      )
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/finance/scholarships/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
