import { NextRequest, NextResponse } from 'next/server'
import { getScholarships, createScholarship, type ScholarshipWriteInput } from '@/lib/supabase/queries/finance'

export async function GET() {
  try {
    return NextResponse.json(await getScholarships())
  } catch (error) {
    console.error('GET /api/finance/scholarships:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const s = await createScholarship((await req.json()) as ScholarshipWriteInput)
    return NextResponse.json(s, { status: 201 })
  } catch (error) {
    console.error('POST /api/finance/scholarships:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
