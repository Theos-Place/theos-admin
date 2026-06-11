import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { getEmployees, createEmployee, type EmployeeWriteInput } from '@/lib/supabase/queries/employees'

// Montos de salario SOLO para rol finanzas (decisión 2026-06-11): el resto
// (incluido admin) ve las filas con los montos en null.
export async function GET() {
  try {
    const auth = await requireModuleView('empleados')
    if (auth.res) return auth.res
    const employees = await getEmployees()
    if (auth.ctx.roles.includes('finanzas')) return NextResponse.json(employees)
    return NextResponse.json(employees.map(e => ({
      ...e,
      salary: null,
      salary_changes: (e.salary_changes ?? []).map(c => ({ ...c, previous_salary: null, new_salary: null })),
    })))
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
