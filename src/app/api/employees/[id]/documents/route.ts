import { NextRequest, NextResponse } from 'next/server'
import { addEmployeeDocument, type DocumentWriteInput } from '@/lib/supabase/queries/employees'

// POST: agrega un documento. Body: DocumentWriteInput (sin employee_id)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = (await req.json()) as Omit<DocumentWriteInput, 'employee_id'>
    const doc = await addEmployeeDocument({ ...body, employee_id: id })
    return NextResponse.json(doc, { status: 201 })
  } catch (error) {
    console.error('POST /api/employees/[id]/documents:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
