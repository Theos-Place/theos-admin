import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { deleteEmployeeDocument } from '@/lib/supabase/queries/employees'
import { reportarError } from '@/lib/observabilidad'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('direccion', 'encargado_staff')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    await deleteEmployeeDocument(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    reportarError('DELETE /api/employees/documents/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
