import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getStudyDemand } from '@/lib/supabase/queries/studies'

// GET /api/studies/analysis?study_code=XX — demanda por zona de un estudio.
export async function GET(req: NextRequest) {
  try {
  const auth = await requireRoles()
  if (auth.res) return auth.res
    const code = req.nextUrl.searchParams.get('study_code')
    if (!code) return NextResponse.json({ error: 'Se requiere study_code' }, { status: 400 })
    return NextResponse.json(await getStudyDemand(code))
  } catch (error) {
    console.error('GET /api/studies/analysis:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
