import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validate'
import { addRefundComment, getRefundComments } from '@/lib/supabase/queries/refund-actions'
import { resolveRefundScope, type RefundScope } from '@/lib/auth/refunds-scope'
import { createAdminClient } from '@/lib/supabase/admin'

// FIN-6 (3) · Comentarios de una devolución. Los ve y los escribe quien tiene
// alcance sobre ELLA: finanzas, o el responsable del origen (encargado del
// evento / coordinación de estudios). Resolver sigue siendo de finanzas y no
// pasa por acá.
const bodySchema = z.object({
  body: z.string().trim().min(1).max(2000),
}).strict()

/** ¿Este alcance alcanza a ESTA devolución? Mismo criterio que el listado. */
async function puedeVer(scope: RefundScope, refundId: string): Promise<boolean> {
  if (scope.access === 'all') return true
  if (scope.access === 'none') return false
  const { data } = await createAdminClient()
    .from('refunds').select('kind, event_id').eq('id', refundId).maybeSingle()
  const r = data as { kind: string | null; event_id: string | null } | null
  if (!r) return false
  if (scope.access === 'studies') return ['estudio', 'campana', 'prematrimonial'].includes(r.kind ?? '')
  return !!r.event_id && scope.eventIds.includes(r.event_id)
}

async function scopeFor(roles: readonly string[], memberId: string | null): Promise<RefundScope> {
  const { getManagedEventIds } = await import('@/lib/supabase/queries/events')
  const managedEventIds = memberId ? await getManagedEventIds(memberId) : []
  return resolveRefundScope({ roles, managedEventIds })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Devolución no encontrada' }, { status: 404 })
    const scope = await scopeFor(auth.ctx.roles, auth.ctx.memberId)
    if (!(await puedeVer(scope, id))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    return NextResponse.json({ items: await getRefundComments(id) })
  } catch (error) {
    console.error('GET /api/finance/refunds/[id]/comments:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Devolución no encontrada' }, { status: 404 })
    const scope = await scopeFor(auth.ctx.roles, auth.ctx.memberId)
    if (!(await puedeVer(scope, id))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }

    const created = await addRefundComment(id, auth.ctx.memberId, parsed.data.body)
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('POST /api/finance/refunds/[id]/comments:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
