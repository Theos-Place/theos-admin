import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireModuleView } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportarError } from '@/lib/observabilidad'
import { logAudit } from '@/lib/audit'
import { audienciaDeRecurso } from '@/lib/recursos/reglas'
import { getRecurso, borrarArchivo } from '@/lib/supabase/queries/resources'

/** REC-1 · Editar los datos y la audiencia de un recurso, o retirarlo. Solo el permiso `recursos`. */
const esquema = z.object({
  title: z.string().trim().min(1, 'Falta el título').max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  category: z.string().trim().max(80).nullable().optional(),
  // null = despublicar (vuelve a ser borrador de gestión).
  audience: z.unknown().optional(),
}).strict()

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleView('recursos', { action: 'edit' })
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const parsed = esquema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    }
    const antes = await getRecurso(id)
    if (!antes) return NextResponse.json({ error: 'Recurso no encontrado' }, { status: 404 })

    const d = parsed.data
    const cambios: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (d.title !== undefined) cambios.title = d.title
    if (d.description !== undefined) cambios.description = d.description || null
    if (d.category !== undefined) cambios.category = d.category || null
    if ('audience' in d) cambios.audience = audienciaDeRecurso(d.audience)

    const supabase = createAdminClient()
    const { error } = await supabase.from('resources').update(cambios as never).eq('id', id)
    if (error) throw error
    await logAudit({
      actorUserId: auth.ctx.userId, action: 'UPDATE', entityType: 'resources', entityId: id,
      oldData: { title: antes.title, category: antes.category, description: antes.description, audience: antes.audience },
      newData: cambios,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    reportarError('PATCH /api/resources/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleView('recursos', { action: 'delete' })
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const r = await getRecurso(id)
    if (!r) return NextResponse.json({ error: 'Recurso no encontrado' }, { status: 404 })
    const supabase = createAdminClient()
    const { error } = await supabase.from('resources').delete().eq('id', id)
    if (error) throw error
    // La fila ya no existe: si el archivo no se puede borrar, queda huérfano y
    // lo recoge el cron de storage-orphans. No es motivo para fallar.
    await borrarArchivo(r.file_path).catch(e => reportarError('DELETE /api/resources/[id] archivo:', e))
    await logAudit({
      actorUserId: auth.ctx.userId, action: 'DELETE', entityType: 'resources', entityId: id,
      oldData: { title: r.title, category: r.category, file_name: r.file_name, audience: r.audience },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    reportarError('DELETE /api/resources/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
