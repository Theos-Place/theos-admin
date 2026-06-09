import { NextRequest, NextResponse } from 'next/server'
import { getDuplicatePairs, dismissDuplicatePair } from '@/lib/supabase/queries/members'
import { requireRoles } from '@/lib/auth/guard'

export async function GET() {
  try {
    const auth = await requireRoles('admin', 'editor_perfiles')
    if (auth.res) return auth.res
    return NextResponse.json(await getDuplicatePairs())
  } catch (error) {
    console.error('GET /api/members/duplicates:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRoles('admin', 'editor_perfiles')
    if (auth.res) return auth.res
    const body = (await req.json()) as { a?: string; b?: string }
    if (!body.a || !body.b) return NextResponse.json({ error: 'Faltan ids' }, { status: 400 })
    await dismissDuplicatePair(body.a, body.b)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/members/duplicates:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
