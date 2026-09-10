import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  transferEnrollment, TransferenciaBloqueada,
} from '@/lib/supabase/queries/transfer-enrollment'
import {
  destinosPosibles, pagosQueViajan, planDeDinero, resumenDeLaAccion,
  type GrupoParaTransferir, type PagoConMonto,
} from '@/lib/studies/transferencia'

// Mover una matrícula de grupo, con su pago.
//
// GATE: STUDY_ADMIN_ROLES. El DIRIGENTE no: para él existe la solicitud de
// reubicación, que pasa por coordinación. Mover a alguien cambia plata.
//
// GET  → a qué grupos se puede mover, y qué pasaría con cada uno.
// PATCH → lo hace.

type Fila = { id: string; member_id: string; group_id: string | null; status: string }

async function leerMatricula(id: string): Promise<Fila | null> {
  const sb = createAdminClient()
  const { data, error } = await sb.from('study_enrollments')
    .select('id, member_id, group_id, status').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as Fila | null) ?? null
}

/** Los grupos abiertos, con su costo y su ocupación, en el vocabulario de las reglas. */
async function gruposAbiertos(): Promise<GrupoParaTransferir[]> {
  const sb = createAdminClient()
  const { data, error } = await sb.from('study_groups')
    .select('id, name, plan_id, max_students, status, schedule_days, schedule_time, zone, plan:study_plans!study_groups_plan_id_fkey(code, cost, currency)')
    .in('status', ['en_matricula', 'en_curso'])
  if (error) throw error
  const grupos = (data ?? []) as unknown as Array<{
    id: string; name: string; plan_id: string | null; max_students: number | null; status: string
    schedule_days: string[] | null; schedule_time: string | null; zone: string | null
    plan: { code: string | null; cost: number | null; currency: string | null } | null
  }>
  // Una sola consulta para la ocupación de todos: pedirla grupo por grupo eran
  // 100 consultas para pintar un selector.
  const { data: enr } = await sb.from('study_enrollments')
    .select('group_id').eq('status', 'enrolled').in('group_id', grupos.map(g => g.id))
  const ocupacion = new Map<string, number>()
  for (const e of (enr ?? []) as { group_id: string }[]) {
    ocupacion.set(e.group_id, (ocupacion.get(e.group_id) ?? 0) + 1)
  }
  return grupos.map(g => ({
    id: g.id, name: g.name, plan_id: g.plan_id, status: g.status,
    costo: Number(g.plan?.cost ?? 0), currency: g.plan?.currency ?? 'CRC',
    max_students: g.max_students, inscritos: ocupacion.get(g.id) ?? 0,
  }))
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(...STUDY_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const enr = await leerMatricula(id)
    if (!enr?.group_id) return NextResponse.json({ error: 'Matrícula no encontrada' }, { status: 404 })

    const todos = await gruposAbiertos()
    // El origen puede NO estar en la lista de abiertos (un grupo ya cerrado del
    // que igual hay que sacar a alguien), así que se busca aparte.
    const sb = createAdminClient()
    let origen = todos.find(g => g.id === enr.group_id) ?? null
    if (!origen) {
      const { data } = await sb.from('study_groups')
        .select('id, name, plan_id, max_students, status, plan:study_plans!study_groups_plan_id_fkey(cost, currency)')
        .eq('id', enr.group_id).maybeSingle()
      if (!data) return NextResponse.json({ error: 'Grupo de origen no encontrado' }, { status: 404 })
      const g = data as unknown as {
        id: string; name: string; plan_id: string | null; max_students: number | null; status: string
        plan: { cost: number | null; currency: string | null } | null
      }
      origen = {
        id: g.id, name: g.name, plan_id: g.plan_id, status: g.status,
        costo: Number(g.plan?.cost ?? 0), currency: g.plan?.currency ?? 'CRC',
        max_students: g.max_students, inscritos: 0,
      }
    }

    const { data: suyas } = await sb.from('study_enrollments')
      .select('group_id, status').eq('member_id', enr.member_id)
    const estadoPorGrupo: Record<string, string> = {}
    for (const e of (suyas ?? []) as { group_id: string | null; status: string }[]) {
      if (e.group_id) estadoPorGrupo[e.group_id] = e.status
    }

    const posibles = destinosPosibles(origen, todos, estadoPorGrupo)

    // Qué pasaría con la plata en cada destino: se calcula acá para que la
    // pantalla muestre el monto exacto ANTES de confirmar, y no una promesa.
    const { data: pagosRaw } = await sb.from('payments')
      .select('id, status, review_status, concept, amount').eq('enrollment_id', id)
    const viajan = pagosQueViajan((pagosRaw ?? []) as PagoConMonto[]) as PagoConMonto[]

    return NextResponse.json({
      origen: { id: origen.id, name: origen.name, costo: origen.costo, currency: origen.currency },
      destinos: posibles.map(d => {
        const dinero = planDeDinero({ pagos: viajan, costoDestino: d.costo, moneda: d.currency })
        return {
          id: d.id, name: d.name, costo: d.costo, currency: d.currency,
          cupo: d.max_students, inscritos: d.inscritos,
          cobrar: dinero.cobrar, saldo_a_favor: dinero.saldoAFavor, mensaje: dinero.mensaje,
        }
      }),
    })
  } catch (error) {
    console.error('GET /api/studies/enrollments/[id]/transfer:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

const schema = z.object({ target_group_id: z.string().trim().min(1) }).strict()

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(...STUDY_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 },
      )
    }
    const enr = await leerMatricula(id)
    if (!enr?.group_id) return NextResponse.json({ error: 'Matrícula no encontrada' }, { status: 404 })

    const sb = createAdminClient()
    const { data: quien } = auth.ctx.memberId
      ? await sb.from('members').select('first_name, last_name').eq('id', auth.ctx.memberId).maybeSingle()
      : { data: null }
    const q = quien as { first_name: string; last_name: string } | null

    const r = await transferEnrollment({
      memberId: enr.member_id,
      desdeGroupId: enr.group_id,
      haciaGroupId: parsed.data.target_group_id,
      actorMemberId: auth.ctx.memberId,
      actorNombre: q ? `${q.first_name} ${q.last_name}`.trim() : 'el sistema',
    })
    const { data: persona } = await sb.from('members')
      .select('first_name, last_name').eq('id', enr.member_id).maybeSingle()
    const p = persona as { first_name: string; last_name: string } | null
    return NextResponse.json({
      ...r,
      resumen: resumenDeLaAccion({
        persona: p ? `${p.first_name} ${p.last_name}`.trim() : 'la persona',
        desde: r.desde_grupo, hacia: r.hacia_grupo, mensajeDelDinero: r.mensaje,
      }),
    })
  } catch (error) {
    if (error instanceof TransferenciaBloqueada) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 })
    }
    console.error('PATCH /api/studies/enrollments/[id]/transfer:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
