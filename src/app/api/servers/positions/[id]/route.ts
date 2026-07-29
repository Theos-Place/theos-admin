import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import {
  updateServicePosition, deleteServicePosition,
} from '@/lib/supabase/queries/servers'

// Validación runtime del patch de puestos. El patch se esparce entero al update
// de `service_positions` con service role: `.strict()` corta el mass assignment.
const positionUpdateSchema = z
  .object({
    area_id: z.string().trim().min(1),
    base_area_id: z.string().trim().min(1).nullish(),
    title: z.string().trim().min(1),
    description: z.string().trim().nullish(),
    location: z.string().trim().nullish(),
    quantity: z.number().int().min(0).nullish(),
    study_requirement: z.string().trim().nullish(),
    functions: z.string().trim().nullish(),
    profile: z.string().trim().nullish(),
    skills: z.string().trim().nullish(),
    expires_at: z.string().trim().min(1).nullish(),
    is_featured: z.boolean().optional(),
  })
  .strict()
  .partial()

// PUT: edita un puesto (campos del formato real).
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles(...SERVICE_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const parsed = positionUpdateSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    await updateServicePosition(id, parsed.data)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/servers/positions/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE: elimina un puesto. El conteo de servidores activos (para el
// ActiveWarningModal antes de confirmar) se consulta con GET ./usage.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles(...SERVICE_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    await deleteServicePosition(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/servers/positions/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
