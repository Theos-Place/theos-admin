import { NextRequest, NextResponse } from 'next/server'
import { getMembers } from '@/lib/supabase/queries/members'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const search    = searchParams.get('search')   ?? undefined
    const is_active = searchParams.get('is_active')
    const is_donor  = searchParams.get('is_donor')
    const page      = Number(searchParams.get('page') ?? 1)
    const pageSize  = Number(searchParams.get('pageSize') ?? 50)

    const result = await getMembers({
      search,
      is_active: is_active !== null ? is_active === 'true' : true,
      is_donor:  is_donor  !== null ? is_donor  === 'true' : undefined,
      page,
      pageSize,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/members:', error)
    const detail = error instanceof Error
      ? { message: error.message, ...(error as unknown as Record<string, unknown>) }
      : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { createMember } = await import('@/lib/supabase/queries/members')
    const member = await createMember(body)
    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    console.error('POST /api/members:', error)
    const detail = error instanceof Error
      ? { message: error.message, ...(error as unknown as Record<string, unknown>) }
      : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}