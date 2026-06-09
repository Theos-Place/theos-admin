import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { updateEmployee, type EmployeeWriteInput } from '@/lib/supabase/queries/employees'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('direccion', 'encargado_staff')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    await updateEmployee(id, (await req.json()) as Partial<EmployeeWriteInput>)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/employees/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
