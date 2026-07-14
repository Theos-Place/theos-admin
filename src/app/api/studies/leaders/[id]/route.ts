import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { updateLeader } from '@/lib/supabase/queries/studies'
import { leaderUpdateSchema } from '../schema'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('coordinador_estudios', 'coordinador_dirigentes', 'direccion')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    const parsed = leaderUpdateSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    await updateLeader(id, parsed.data)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/studies/leaders/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
