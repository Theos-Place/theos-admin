import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { updateCommittee } from '@/lib/supabase/queries/servers'
import { reportarError } from '@/lib/observabilidad'

// Validación runtime del patch del comité. El patch va directo al update de
// `areas` con service role: `.strict()` corta el mass assignment.
const committeeUpdateSchema = z
  .object({
    name: z.string().trim().min(1),
    description: z.string().trim().nullish(),
    parent_id: z.string().trim().min(1).nullish(),
    // leader_id NO se acepta (SRV-5): el encargado se marca con la estrella en
    // la lista de personas, que es lo que le da el puesto y el rol. `.strict()`
    // hace que mandarlo devuelva 400 en vez de escribir un dato en desuso.
  })
  .strict()
  .partial()

// PUT: edita el comité (nombre y área padre).
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('encargado_staff', 'direccion', 'lider_comite')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    const parsed = committeeUpdateSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    await updateCommittee(id, parsed.data)
    return NextResponse.json({ ok: true })
  } catch (error) {
    reportarError('PUT /api/servers/committees/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
