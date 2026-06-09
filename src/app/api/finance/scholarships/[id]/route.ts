import { NextRequest, NextResponse } from 'next/server'
import { markScholarshipUsed } from '@/lib/supabase/queries/finance'

// PUT: marca la beca como usada.
export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await markScholarshipUsed(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/finance/scholarships/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
