import { NextRequest, NextResponse } from 'next/server'
import { updateEmployee, type EmployeeWriteInput } from '@/lib/supabase/queries/employees'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await updateEmployee(id, (await req.json()) as Partial<EmployeeWriteInput>)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/employees/[id]:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
