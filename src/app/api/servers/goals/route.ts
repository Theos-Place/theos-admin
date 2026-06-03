import { NextRequest, NextResponse } from 'next/server'
import { getCommitteeGoals, createGoal } from '@/lib/supabase/queries/servers'

export async function GET() {
  try {
    return NextResponse.json(await getCommitteeGoals())
  } catch (error) {
    console.error('GET /api/servers/goals:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const goal = await createGoal(await req.json())
    return NextResponse.json(goal, { status: 201 })
  } catch (error) {
    console.error('POST /api/servers/goals:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
