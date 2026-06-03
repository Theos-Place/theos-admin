import { NextResponse } from 'next/server'
import { getWaitlist } from '@/lib/supabase/queries/studies'

export async function GET() {
  try {
    return NextResponse.json(await getWaitlist())
  } catch (error) {
    console.error('GET /api/studies/waitlist:', error)
    const detail = error instanceof Error
      ? { message: error.message, ...(error as unknown as Record<string, unknown>) }
      : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
