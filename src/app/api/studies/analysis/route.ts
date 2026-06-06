import { NextRequest, NextResponse } from 'next/server'
import { getStudyDemand } from '@/lib/supabase/queries/studies'

// GET /api/studies/analysis?study_code=XX — demanda por zona de un estudio.
export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('study_code')
    if (!code) return NextResponse.json({ error: 'Se requiere study_code' }, { status: 400 })
    return NextResponse.json(await getStudyDemand(code))
  } catch (error) {
    console.error('GET /api/studies/analysis:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
