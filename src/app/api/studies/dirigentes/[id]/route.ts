import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  updateDirigenteConfig, setDirigenteActive, setLeaderAdminStatus, membersWithActiveGroups,
} from '@/lib/supabase/queries/studies'
import { requireRoles } from '@/lib/auth/guard'
import {
  EN_REVISION_BLOCK_MESSAGE, SETTABLE_STATUSES, canSeeLeaderAdminStatus,
} from '@/lib/studies/leader-admin-status'

const bodySchema = z.object({
  qualified_study_codes: z.array(z.string()).optional(),
  zone_preference: z.array(z.string()).optional(),
  active: z.boolean().optional(),
  // DIR-6: el matiz administrativo. Solo lo escriben los roles que lo ven.
  availability_status: z.enum(SETTABLE_STATUSES).optional(),
}).strict()

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRoles('admin', 'direccion', 'coordinador_dirigentes', 'coordinador_estudios')
    if (auth.res) return auth.res
    const { id } = await params // member_id

    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    }
    const body = parsed.data

    // DIR-6 · Estado administrativo. Gate propio DENTRO del handler: este
    // endpoint lo abre también 'direccion', que puede activar/desactivar pero
    // NO poner a nadie en pausa ni en revisión.
    if (body.availability_status !== undefined) {
      if (!canSeeLeaderAdminStatus(auth.ctx.roles)) {
        return NextResponse.json(
          { error: 'El estado administrativo lo maneja la coordinación de dirigentes.' },
          { status: 403 },
        )
      }
      await setLeaderAdminStatus(id, body.availability_status)
    }

    // Toggle manual de estado (activo/inactivo). No se puede desactivar a quien
    // tiene un grupo en curso/abierto (punto 1).
    if (typeof body.active === 'boolean') {
      if (!body.active) {
        const blocked = await membersWithActiveGroups([id])
        if (blocked.has(id)) {
          return NextResponse.json(
            { error: 'No se puede desactivar: tiene un grupo en curso o abierto.', code: 'has_active_groups' },
            { status: 409 },
          )
        }
      }
      await setDirigenteActive(id, body.active)
    }
    if (body.qualified_study_codes !== undefined || body.zone_preference !== undefined) {
      await updateDirigenteConfig(id, body)
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'DIRIGENTE_NO_RECOMENDADO') {
      return NextResponse.json(
        { error: 'Esta persona está marcada como no recomendada para dar estudios.' },
        { status: 400 },
      )
    }
    if (error instanceof Error && error.message === 'DIRIGENTE_EN_REVISION') {
      return NextResponse.json(
        { error: EN_REVISION_BLOCK_MESSAGE, code: 'dirigente_en_revision' },
        { status: 409 },
      )
    }
    if (error instanceof Error && error.message === 'DIRIGENTE_CON_GRUPO_ACTIVO') {
      return NextResponse.json(
        { error: 'Tiene un grupo en curso o abierto: primero hay que resolver el grupo.', code: 'has_active_groups' },
        { status: 409 },
      )
    }
    console.error('PATCH /api/studies/dirigentes/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
