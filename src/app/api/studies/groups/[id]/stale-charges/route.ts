import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportarError } from '@/lib/observabilidad'
import { logAudit } from '@/lib/audit'
import { modalidadDe, type Modalidad } from '@/lib/studies/modalidad-de-bloques'
import { cobrosQueNoCorresponden, type CobroDeMatricula } from '@/lib/studies/corte-de-bloque'

/**
 * Cobros de matrícula que, con el grupo en el esquema viejo, no corresponden
 * (2026-10-19, el N1 de Guido Chavarría). La regla vive en
 * `cobrosQueNoCorresponden`.
 *
 * GET ?modalidad=legacy → cuáles serían, ANTES de cambiar (para el aviso).
 * DELETE → los borra, calculado con la modalidad YA GUARDADA del grupo: no se
 * puede borrar un cobro diciendo «va a ser legacy» sin que lo sea.
 *
 * Se BORRAN y no se anulan, por decisión de Floriana: son cobros que nunca
 * tendrían que haber existido, y anulados solo ensucian la lista de la persona.
 * El respaldo queda en el audit_log, con la fila completa.
 */
const ROLES = [...STUDY_ADMIN_ROLES, 'finanzas'] as const

async function calcular(groupId: string, modalidad?: Modalidad) {
  const supabase = createAdminClient()
  const { data: g, error: eG } = await supabase.from('study_groups')
    .select('id, modalidad, plan:study_plans!study_groups_plan_id_fkey(code)').eq('id', groupId).maybeSingle()
  if (eG) throw eG
  if (!g) return null
  const plan = (Array.isArray(g.plan) ? g.plan[0] : g.plan) as { code: string | null } | null
  const { data: planes, error: eP } = await supabase.from('study_plans').select('code, cost')
  if (eP) throw eP
  const costos = Object.fromEntries(((planes ?? []) as Array<{ code: string; cost: number | null }>).map(p => [p.code, Number(p.cost ?? 0)]))
  const { data: mats, error: eM } = await supabase.from('study_enrollments').select('id').eq('group_id', groupId)
  if (eM) throw eM
  const ids = ((mats ?? []) as Array<{ id: string }>).map(m => m.id)
  if (!ids.length) return { cobros: [] as Array<CobroDeMatricula & { persona: string }>, modalidad: modalidadDe(g.modalidad) }
  const { data: pagos, error: ePa } = await supabase.from('payments')
    .select('id, amount, status, concept, paid_at, receipt_path, review_status, member:members!payments_member_id_fkey(first_name, last_name)')
    .in('enrollment_id', ids)
  if (ePa) throw ePa
  const filas = (pagos ?? []) as unknown as Array<CobroDeMatricula & { member: { first_name: string; last_name: string } | null }>
  const usada = modalidad ?? modalidadDe(g.modalidad)
  const sobran = cobrosQueNoCorresponden(filas, plan?.code, usada, costos)
  return {
    modalidad: usada,
    cobros: sobran.map(c => {
      const f = filas.find(x => x.id === c.id)!
      return { ...c, persona: `${f.member?.first_name ?? ''} ${f.member?.last_name ?? ''}`.trim() }
    }),
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(...ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const q = new URL(req.url).searchParams.get('modalidad')
    const r = await calcular(id, q ? modalidadDe(q) : undefined)
    if (!r) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 })
    return NextResponse.json({
      modalidad: r.modalidad,
      cobros: r.cobros.map(c => ({ id: c.id, persona: c.persona, monto: Number(c.amount) })),
    })
  } catch (error) {
    reportarError('GET /api/studies/groups/[id]/stale-charges:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(...ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const r = await calcular(id)
    if (!r) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 })
    if (!r.cobros.length) return NextResponse.json({ ok: true, borrados: 0 })
    const supabase = createAdminClient()
    const ids = r.cobros.map(c => c.id)
    const { data: completas } = await supabase.from('payments').select('*').in('id', ids)
    // Se vuelve a exigir todo en el WHERE: si algo cambió entre leer y borrar
    // (alguien subió un comprobante), ese cobro no se toca.
    const { data: borrados, error } = await supabase.from('payments').delete()
      .in('id', ids).eq('status', 'pending').is('paid_at', null).is('receipt_path', null).is('review_status', null)
      .select('id')
    if (error) throw error
    const hechos = new Set(((borrados ?? []) as Array<{ id: string }>).map(b => b.id))
    for (const f of ((completas ?? []) as Array<Record<string, unknown>>).filter(f => hechos.has(f.id as string))) {
      await logAudit({
        actorUserId: auth.ctx.userId, action: 'DELETE', entityType: 'payments', entityId: f.id as string,
        oldData: f, newData: { motivo: 'Cobro que no corresponde con el grupo en el esquema viejo', grupo: id },
      })
    }
    return NextResponse.json({ ok: true, borrados: hechos.size })
  } catch (error) {
    reportarError('DELETE /api/studies/groups/[id]/stale-charges:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
