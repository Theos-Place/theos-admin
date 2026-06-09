import { NextRequest, NextResponse } from 'next/server'
import { updateVacancy, deleteVacancy, type VacancyWriteInput } from '@/lib/supabase/queries/servers'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await updateVacancy(id, (await req.json()) as Partial<VacancyWriteInput>)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/servers/vacancies/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await deleteVacancy(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/servers/vacancies/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
