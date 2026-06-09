import { NextResponse } from 'next/server'
import { getCommittees } from '@/lib/supabase/queries/servers'

export async function GET() {
  try {
    return NextResponse.json(await getCommittees())
  } catch (error) {
    console.error('GET /api/servers/committees:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
