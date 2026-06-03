import { NextRequest, NextResponse } from 'next/server'
import { sendBroadcast, type Recipient } from '@/lib/supabase/queries/communications'

// POST: envía el broadcast. Body: { recipients: Recipient[] }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { recipients } = (await req.json()) as { recipients: Recipient[] }
    await sendBroadcast(id, recipients ?? [])
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/communications/messages/[id]/send:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
