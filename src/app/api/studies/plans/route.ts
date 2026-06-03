import { NextResponse } from 'next/server'
import { getStudyPlans } from '@/lib/supabase/queries/studies'

export async function GET() {
  try {
    const plans = await getStudyPlans()
    return NextResponse.json(plans)
  } catch (error) {
    console.error('GET /api/studies/plans:', error)
    const detail = error instanceof Error
      ? { message: error.message, ...(error as unknown as Record<string, unknown>) }
      : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
