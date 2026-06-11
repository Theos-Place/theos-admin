import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { getEmployees, createEmployee, type EmployeeWriteInput } from '@/lib/supabase/queries/employees'

export async function GET() {
  try {
    const auth = await requireModuleView('empleados')
    if (auth.res) return auth.res
    return NextResponse.json(await getEmployees())
  } catch (error) {
    console.error('GET /api/employees:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRoles('direccion', 'encargado_staff')
    if (auth.res) return auth.res
    const e = await createEmployee((await req.json()) as EmployeeWriteInput)
    return NextResponse.json(e, { status: 201 })
  } catch (error) {
    console.error('POST /api/employees:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
