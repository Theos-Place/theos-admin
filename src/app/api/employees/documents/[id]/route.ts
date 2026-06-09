import { NextRequest, NextResponse } from 'next/server'
import { deleteEmployeeDocument } from '@/lib/supabase/queries/employees'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await deleteEmployeeDocument(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/employees/documents/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
