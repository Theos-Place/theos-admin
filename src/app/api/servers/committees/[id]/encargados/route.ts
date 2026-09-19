import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import { setEncargadoDeComite, ENCARGADO_UNICO_PUESTO } from '@/lib/supabase/queries/servers'
import { reportarError } from '@/lib/observabilidad'

const schema = z.object({
  member_id: z.string().trim().min(1),
  encargado: z.boolean(),
}).strict()

/**
 * PATCH: marca o desmarca a alguien como encargado del comité (SRV-5).
 *
 * `lider_comite` queda FUERA de los roles permitidos a propósito, aunque sí
 * puede asignar gente a puestos por /api/servers/volunteers: un encargado no se
 * nombra a sí mismo ni nombra a otro. Eso lo deciden staff y dirección.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles(...SERVICE_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    await setEncargadoDeComite(id, parsed.data.member_id, parsed.data.encargado, auth.ctx.userId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === ENCARGADO_UNICO_PUESTO) {
      return NextResponse.json({
        error: 'Encargado es su único puesto en el comité. Quitarle la estrella la dejaría fuera: '
          + 'primero dale otro puesto, o usá Desvincular si ya no sirve acá.',
        code: 'encargado_unico_puesto',
      }, { status: 409 })
    }
    reportarError('PATCH /api/servers/committees/[id]/encargados:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
