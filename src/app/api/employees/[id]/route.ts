import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { updateEmployee } from '@/lib/supabase/queries/employees'
import { employeeWriteSchema } from '../schema'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('direccion', 'encargado_staff')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    const parsed = employeeWriteSchema.partial().safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    await updateEmployee(id, parsed.data)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/employees/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
