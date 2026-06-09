import { NextRequest, NextResponse } from 'next/server'
import { getStudyLeaders, createLeader, type LeaderWriteInput } from '@/lib/supabase/queries/studies'

export async function GET() {
  try {
    return NextResponse.json(await getStudyLeaders())
  } catch (error) {
    console.error('GET /api/studies/leaders:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const leader = await createLeader((await req.json()) as LeaderWriteInput)
    return NextResponse.json(leader, { status: 201 })
  } catch (error) {
    console.error('POST /api/studies/leaders:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
