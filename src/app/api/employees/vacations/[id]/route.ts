import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { setVacationStatus } from '@/lib/supabase/queries/employees'

// PUT: aprueba/rechaza una solicitud. Body: { status }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('direccion', 'encargado_staff')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    const { status } = await req.json()
    if (!['aprobado', 'pendiente', 'rechazado'].includes(status)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
    }
    await setVacationStatus(id, status)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'YA_PROCESADO') {
      return NextResponse.json(
        { error: 'La solicitud ya fue procesada (posiblemente por otro revisor). Refrescá la página.' },
        { status: 409 },
      )
    }
    console.error('PUT /api/employees/vacations/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
