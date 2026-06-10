import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getRelocations, createRelocation } from '@/lib/supabase/queries/studies'

export async function GET() {
  try {
  const auth = await requireRoles()
  if (auth.res) return auth.res
    return NextResponse.json(await getRelocations())
  } catch (error) {
    console.error('GET /api/studies/relocations:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
    const auth = await requireRoles('coordinador_estudios', 'coordinador_dirigentes', 'direccion')
    if (auth.res) return auth.res
  try {
    await createRelocation(await req.json())
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('POST /api/studies/relocations:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
