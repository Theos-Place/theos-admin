import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { recordSalaryChange } from '@/lib/supabase/queries/employees'

// POST: registra cambio de salario. Body: { new_salary, reason? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('direccion', 'encargado_staff')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    const { new_salary, reason } = await req.json()
    await recordSalaryChange(id, Number(new_salary), reason)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/employees/[id]/salary:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
