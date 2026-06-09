import { NextRequest, NextResponse } from 'next/server'
import { getMessages, createBroadcast, type BroadcastWriteInput } from '@/lib/supabase/queries/communications'

export async function GET() {
  try {
    return NextResponse.json(await getMessages())
  } catch (error) {
    console.error('GET /api/communications/messages:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await createBroadcast((await req.json()) as BroadcastWriteInput)
    return NextResponse.json(b, { status: 201 })
  } catch (error) {
    console.error('POST /api/communications/messages:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
