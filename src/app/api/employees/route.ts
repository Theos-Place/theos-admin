import { NextRequest, NextResponse } from 'next/server'
import { getEmployees, createEmployee, type EmployeeWriteInput } from '@/lib/supabase/queries/employees'

export async function GET() {
  try {
    return NextResponse.json(await getEmployees())
  } catch (error) {
    console.error('GET /api/employees:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const e = await createEmployee((await req.json()) as EmployeeWriteInput)
    return NextResponse.json(e, { status: 201 })
  } catch (error) {
    console.error('POST /api/employees:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
