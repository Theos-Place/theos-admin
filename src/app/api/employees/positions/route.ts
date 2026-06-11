import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { getPaidPositions, createPosition, type PositionWriteInput } from '@/lib/supabase/queries/employees'

// Rangos salariales SOLO para rol finanzas (decisión 2026-06-11).
export async function GET() {
  try {
    const auth = await requireModuleView('empleados')
    if (auth.res) return auth.res
    const positions = await getPaidPositions()
    if (auth.ctx.roles.includes('finanzas')) return NextResponse.json(positions)
    return NextResponse.json(positions.map(p => ({ ...p, salary_min: null, salary_max: null })))
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
