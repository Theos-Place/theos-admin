import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getChannelConfigs, createConfig, type ConfigWriteInput } from '@/lib/supabase/queries/communications'

export async function GET() {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    return NextResponse.json(await getChannelConfigs())
  } catch (error) {
    console.error('GET /api/communications/configs:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
    const auth = await requireRoles('comunicaciones', 'direccion')
    if (auth.res) return auth.res
  try {
    const c = await createConfig((await req.json()) as ConfigWriteInput)
    return NextResponse.json(c, { status: 201 })
  } catch (error) {
    console.error('POST /api/communications/configs:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
