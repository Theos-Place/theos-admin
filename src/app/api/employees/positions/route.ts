import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getPaidPositions, createPosition, type PositionWriteInput } from '@/lib/supabase/queries/employees'

export async function GET() {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    return NextResponse.json(await getPaidPositions())
  } catch (error) {
    console.error('GET /api/employees/positions:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
    const auth = await requireRoles('direccion', 'encargado_staff')
    if (auth.res) return auth.res
  try {
    const p = await createPosition((await req.json()) as PositionWriteInput)
    return NextResponse.json(p, { status: 201 })
  } catch (error) {
    console.error('POST /api/employees/positions:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
