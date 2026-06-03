import { NextRequest, NextResponse } from 'next/server'
import { updatePosition, deletePosition, type PositionWriteInput } from '@/lib/supabase/queries/employees'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await updatePosition(id, (await req.json()) as Partial<PositionWriteInput>)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/employees/positions/[id]:', error)
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
    await deletePosition(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/employees/positions/[id]:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
