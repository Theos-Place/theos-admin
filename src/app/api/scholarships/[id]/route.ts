import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validate'
import { createAdminClient } from '@/lib/supabase/admin'
import { revokeScholarship } from '@/lib/supabase/queries/scholarships'

// GET ?usage=1: cuántas veces se usó (para decidir DeleteConfirmModal vs ActiveWarningModal en el cliente).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleView('becas')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })
    const supabase = createAdminClient()
    const [{ data: scholarship }, { count }] = await Promise.all([
      supabase.from('scholarships').select('status').eq('id', id).maybeSingle(),
      supabase.from('scholarship_redemptions').select('id', { count: 'exact', head: true }).eq('scholarship_id', id),
    ])
    const usedDirectly = (scholarship as { status: string } | null)?.status === 'used'
    return NextResponse.json({ used_count: (count ?? 0) + (usedDirectly ? 1 : 0) })
  } catch (error) {
    console.error('GET /api/scholarships/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE: revoca (no borra físicamente — status='revoked'). Bloqueado si ya está usada.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleView('becas', { action: 'edit' })
  if (auth.res) return auth.res
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })
    const revoked = await revokeScholarship(id)
    if (!revoked) return NextResponse.json({ error: 'No se puede revocar: ya fue usada o no está activa.' }, { status: 409 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/scholarships/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
