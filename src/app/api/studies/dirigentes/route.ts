import { NextRequest, NextResponse } from 'next/server'
import { getActiveDirigentes, addDirigente } from '@/lib/supabase/queries/studies'
import { requireRoles } from '@/lib/auth/guard'

export async function GET() {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    return NextResponse.json(await getActiveDirigentes())
  } catch (error) {
    console.error('GET /api/studies/dirigentes:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRoles('admin', 'coordinador_dirigentes')
    if (auth.res) return auth.res
    const body = (await req.json()) as { member_id?: string; active?: boolean }
    if (!body.member_id) return NextResponse.json({ error: 'Falta member_id' }, { status: 400 })
    await addDirigente(body.member_id, Boolean(body.active))
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('POST /api/studies/dirigentes:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
