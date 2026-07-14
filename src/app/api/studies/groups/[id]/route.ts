import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { updateGroup, getGroupById } from '@/lib/supabase/queries/studies'
import { groupWriteSchema } from '../schema'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const { id } = await params
    const group = await getGroupById(id)
    if (!group) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 })
    // El roster (nombres y notas de los inscritos) es solo para el módulo
    // estudios; otras sesiones (p. ej. la confirmación de matrícula) reciben
    // el grupo sin inscripciones.
    const mod = await requireModuleView('estudios')
    if (mod.res) return NextResponse.json({ ...group, enrollments: [] })
    return NextResponse.json(group)
  } catch (error) {
    console.error('GET /api/studies/groups/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('coordinador_estudios', 'coordinador_dirigentes', 'direccion')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    const parsed = groupWriteSchema.partial().safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    await updateGroup(id, parsed.data)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/studies/groups/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
