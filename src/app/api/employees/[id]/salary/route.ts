import { NextRequest, NextResponse } from 'next/server'
import { recordSalaryChange } from '@/lib/supabase/queries/employees'

// POST: registra cambio de salario. Body: { new_salary, reason? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { new_salary, reason } = await req.json()
    await recordSalaryChange(id, Number(new_salary), reason)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/employees/[id]/salary:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
