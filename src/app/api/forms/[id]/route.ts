import { NextRequest, NextResponse } from 'next/server'
import { getFormById, updateForm, deleteForm } from '@/lib/supabase/queries/forms'
import { formToPartialWriteInput, formToFields } from '@/lib/forms/form-mapper'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const form = await getFormById(id)
    if (!form) return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 })
    return NextResponse.json(form)
  } catch (error) {
    console.error('GET /api/forms/[id]:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json()
    const fields = 'fields' in body ? formToFields(body) : undefined
    await updateForm(id, formToPartialWriteInput(body), fields)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/forms/[id]:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await deleteForm(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/forms/[id]:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
