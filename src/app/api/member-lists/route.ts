import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getMemberLists, createMemberList } from '@/lib/supabase/queries/member-lists'

export async function GET() {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    return NextResponse.json(await getMemberLists())
  } catch (error) {
    console.error('GET /api/member-lists:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
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
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
