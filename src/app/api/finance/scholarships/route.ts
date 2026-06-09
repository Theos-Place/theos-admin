import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getScholarships, createScholarship, type ScholarshipWriteInput } from '@/lib/supabase/queries/finance'

export async function GET() {
  try {
    return NextResponse.json(await getScholarships())
  } catch (error) {
    console.error('GET /api/finance/scholarships:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
    const auth = await requireRoles('finanzas', 'direccion')
    if (auth.res) return auth.res
  try {
    const s = await createScholarship((await req.json()) as ScholarshipWriteInput)
    return NextResponse.json(s, { status: 201 })
  } catch (error) {
    console.error('POST /api/finance/scholarships:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
