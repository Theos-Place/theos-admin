import { NextResponse } from 'next/server'
import { getSedes } from '@/lib/supabase/queries/sedes'

export async function GET() {
  try {
    return NextResponse.json(await getSedes())
  } catch (error) {
    console.error('GET /api/sedes:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
