import { NextResponse } from 'next/server'
import { getStudyGroups } from '@/lib/supabase/queries/studies'

export async function GET() {
  try {
    const groups = await getStudyGroups()
    return NextResponse.json(groups)
  } catch (error) {
    console.error('GET /api/studies/groups:', error)
    const detail = error instanceof Error
      ? { message: error.message, ...(error as unknown as Record<string, unknown>) }
      : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
