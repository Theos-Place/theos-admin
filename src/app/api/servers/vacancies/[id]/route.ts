import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { canManageCommittee } from '@/lib/auth/committee-scope'
import { updateVacancy, deleteVacancy, getVacancyCommitteeId } from '@/lib/supabase/queries/servers'
import { vacancyWriteSchema } from '../schema'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const committeeId = await getVacancyCommitteeId(id)
    if (!(await canManageCommittee(auth.ctx.roles, auth.ctx.memberId, committeeId))) {
      return NextResponse.json({ error: 'No podés editar vacantes de este comité.' }, { status: 403 })
    }
    const parsed = vacancyWriteSchema.partial().safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    await updateVacancy(id, parsed.data)
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
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const committeeId = await getVacancyCommitteeId(id)
    if (!(await canManageCommittee(auth.ctx.roles, auth.ctx.memberId, committeeId))) {
      return NextResponse.json({ error: 'No podés eliminar vacantes de este comité.' }, { status: 403 })
    }
    await deleteVacancy(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/servers/vacancies/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
