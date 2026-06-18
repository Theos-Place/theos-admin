import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { revokeException } from '@/lib/supabase/queries/study-exceptions'

// DELETE /api/studies/exceptions/[id] → revoca la excepción (status = revoked).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(...STUDY_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    await revokeException(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/studies/exceptions/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
