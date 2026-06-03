import { NextResponse } from 'next/server'
import { getForms } from '@/lib/supabase/queries/forms'

export async function GET() {
  try {
    return NextResponse.json(await getForms())
  } catch (error) {
    console.error('GET /api/forms:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
