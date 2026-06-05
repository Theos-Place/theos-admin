import { NextResponse } from 'next/server'
import { getMemberCounts } from '@/lib/supabase/queries/members'

// GET: conteos para los chips/header (total, donadores, servidores, activos_asistencia).
export async function GET() {
  try {
    return NextResponse.json(await getMemberCounts())
  } catch (error) {
    console.error('GET /api/members/counts:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
