import { NextResponse } from 'next/server'
import { getActiveDirigentes } from '@/lib/supabase/queries/studies'

export async function GET() {
  try {
    return NextResponse.json(await getActiveDirigentes())
  } catch (error) {
    console.error('GET /api/studies/dirigentes:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
