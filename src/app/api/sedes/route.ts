import { NextResponse } from 'next/server'
import { getSedes } from '@/lib/supabase/queries/sedes'

export async function GET() {
  try {
    return NextResponse.json(await getSedes())
  } catch (error) {
    console.error('GET /api/sedes:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
