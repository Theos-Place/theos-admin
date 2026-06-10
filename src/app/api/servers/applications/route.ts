import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getApplications, createApplication } from '@/lib/supabase/queries/servers'

export async function GET() {
  try {
  const auth = await requireRoles()
  if (auth.res) return auth.res
    return NextResponse.json(await getApplications())
  } catch (error) {
    console.error('GET /api/servers/applications:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
    const auth = await requireRoles('encargado_staff', 'direccion', 'lider_comite')
    if (auth.res) return auth.res
  try {
    await createApplication(await req.json())
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('POST /api/servers/applications:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
