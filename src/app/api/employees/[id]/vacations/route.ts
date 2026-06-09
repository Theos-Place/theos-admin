import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { createVacationRecord, type VacationWriteInput } from '@/lib/supabase/queries/employees'

// POST: crea una solicitud de vacaciones/permiso. Body: VacationWriteInput (sin employee_id)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('direccion', 'encargado_staff')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    const body = (await req.json()) as Omit<VacationWriteInput, 'employee_id'>
    const v = await createVacationRecord({ ...body, employee_id: id })
    return NextResponse.json(v, { status: 201 })
  } catch (error) {
    console.error('POST /api/employees/[id]/vacations:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
