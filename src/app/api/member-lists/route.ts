import { NextRequest, NextResponse } from 'next/server'
import { getMemberLists, createMemberList } from '@/lib/supabase/queries/member-lists'

export async function GET() {
  try {
    return NextResponse.json(await getMemberLists())
  } catch (error) {
    console.error('GET /api/member-lists:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body?.name) return NextResponse.json({ error: 'Se requiere name' }, { status: 400 })
    const list = await createMemberList(body)
    return NextResponse.json(list, { status: 201 })
  } catch (error) {
    console.error('POST /api/member-lists:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
