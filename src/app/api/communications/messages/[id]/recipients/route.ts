import { NextRequest, NextResponse } from 'next/server'
import { getMessageRecipients } from '@/lib/supabase/queries/communications'

// GET: destinatarios reales de un broadcast (message_logs).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    return NextResponse.json(await getMessageRecipients(id))
  } catch (error) {
    console.error('GET /api/communications/messages/[id]/recipients:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
