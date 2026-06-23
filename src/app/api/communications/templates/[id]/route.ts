import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { updateTemplate, deleteTemplate, type TemplateWriteInput } from '@/lib/supabase/queries/communications'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('comunicaciones', 'direccion')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    await updateTemplate(id, (await req.json()) as Partial<TemplateWriteInput>)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/communications/templates/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('comunicaciones', 'direccion')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    await deleteTemplate(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'SYSTEM_TEMPLATE_PROTECTED') {
      return NextResponse.json({ error: 'Las plantillas del sistema no se pueden eliminar.' }, { status: 403 })
    }
    console.error('DELETE /api/communications/templates/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
