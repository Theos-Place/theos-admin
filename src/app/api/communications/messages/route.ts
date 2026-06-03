import { NextResponse } from 'next/server'
import { getMessages } from '@/lib/supabase/queries/communications'

export async function GET() {
  try {
    return NextResponse.json(await getMessages())
  } catch (error) {
    console.error('GET /api/communications/messages:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
