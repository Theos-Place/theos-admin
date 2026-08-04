import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { getMessageRecipients } from '@/lib/supabase/queries/communications'

// GET: destinatarios reales de un broadcast (message_logs).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireModuleView('comunicaciones')
    if (auth.res) return auth.res
    const { id } = await params
    const { searchParams } = req.nextUrl
    const statusParam = searchParams.get('status')
    const status = statusParam === 'sent' || statusParam === 'failed' || statusParam === 'skipped'
      ? statusParam : 'all'
    const page = Math.max(1, Math.trunc(Number(searchParams.get('page') ?? 1) || 1))
    const pageSize = Math.min(200, Math.max(1, Math.trunc(Number(searchParams.get('pageSize') ?? 50) || 50)))
    const { rows, total } = await getMessageRecipients(id, { page, pageSize, status })
    return NextResponse.json({ recipients: rows, total })
  } catch (error) {
    console.error('GET /api/communications/messages/[id]/recipients:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
