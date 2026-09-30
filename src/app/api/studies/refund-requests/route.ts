import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRefund } from '@/lib/supabase/queries/finance'
import { logAudit } from '@/lib/audit'
import { isUuid } from '@/lib/validate'
import { reportarError } from '@/lib/observabilidad'
import {
  PUEDEN_SOLICITAR_DEVOLUCION, PAGOS_DEVOLVIBLES, DEVOLUCIONES_VIVAS,
  motivoQueImpideSolicitar, validarJustificacion, razonDeLaSolicitud,
  JUSTIFICACION_MAX,
} from '@/lib/studies/solicitud-de-devolucion'

/**
 * DEV-2 · La coordinación de estudios pide una devolución SIN VER PAGOS.
 *
 * El acuerdo entre Ari y María José está explicado en
 * `lib/studies/solicitud-de-devolucion`. Lo que importa acá: **nada de lo que
 * sale de estos dos handlers menciona un monto, un método ni un id de pago.**
 * Quien pide elige la matrícula; el pago lo resuelve el servidor y lo verifica
 * finanzas en su cola.
 *
 * La devolución se crea con el MISMO camino que usa finanzas (`createRefund`
 * → RPC `create_refund`), así que hereda el lock del pago, el tope contra lo
 * ya devuelto y el estampado del tipo. Inventar un segundo camino de escritura
 * habría duplicado esas tres reglas.
 */

const solicitud = z.object({
  enrollment_id: z.string().refine(isUuid, 'enrollment_id inválido'),
  justificacion: z.string().trim().min(1).max(JUSTIFICACION_MAX),
})

type MatriculaCruda = {
  id: string
  member_id: string
  status: string | null
  enrolled_at: string | null
  plan: { name: string | null } | Array<{ name: string | null }> | null
  grupo: { name: string | null } | Array<{ name: string | null }> | null
}

const uno = <T,>(v: unknown): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null)) as T | null

const nombreDe = (m: MatriculaCruda): string =>
  uno<{ name: string | null }>(m.plan)?.name
  ?? uno<{ name: string | null }>(m.grupo)?.name
  ?? 'Estudio'

/** Los pagos devolvibles de esas matrículas, y cuáles ya tienen devolución
 *  viva. UNA consulta por cosa, no una por matrícula. */
async function pagosDeLasMatriculas(enrollmentIds: string[]) {
  const supabase = createAdminClient()
  if (!enrollmentIds.length) return { porMatricula: new Map<string, string[]>(), conDevolucion: new Set<string>() }
  const { data: pagos, error } = await supabase
    .from('payments').select('id, enrollment_id, status')
    .in('enrollment_id', enrollmentIds).in('status', PAGOS_DEVOLVIBLES as string[])
  if (error) throw error

  const porMatricula = new Map<string, string[]>()
  const ids: string[] = []
  for (const p of (pagos ?? []) as Array<{ id: string; enrollment_id: string }>) {
    const ya = porMatricula.get(p.enrollment_id)
    if (ya) ya.push(p.id); else porMatricula.set(p.enrollment_id, [p.id])
    ids.push(p.id)
  }

  const conDevolucion = new Set<string>()
  if (ids.length) {
    const { data: devs } = await supabase
      .from('refunds').select('payment_id')
      .in('payment_id', ids).in('status', DEVOLUCIONES_VIVAS as string[])
    for (const d of (devs ?? []) as Array<{ payment_id: string }>) conDevolucion.add(d.payment_id)
  }
  return { porMatricula, conDevolucion }
}

/**
 * GET ?member_id= · Las matrículas de esa persona sobre las que se PUEDE pedir
 * una devolución, y las que no con su motivo en palabras.
 *
 * Se devuelven TAMBIÉN las que no se pueden, con `motivo`. Una lista que
 * simplemente las esconde deja a quien pide sin saber si se equivocó de
 * persona o si el sistema no tiene el pago: las dos se ven igual, y la
 * segunda termina en un mensaje a TI.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireRoles(...PUEDEN_SOLICITAR_DEVOLUCION)
    if (auth.res) return auth.res

    const memberId = req.nextUrl.searchParams.get('member_id')
    if (!memberId || !isUuid(memberId)) {
      return NextResponse.json({ error: 'member_id inválido' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('study_enrollments')
      .select('id, member_id, status, enrolled_at, plan:study_plans(name), grupo:study_groups!study_enrollments_group_id_fkey(name)')
      .eq('member_id', memberId)
      .order('enrolled_at', { ascending: false })
    if (error) throw error

    const matriculas = (data ?? []) as unknown as MatriculaCruda[]
    const { porMatricula, conDevolucion } = await pagosDeLasMatriculas(matriculas.map(m => m.id))

    const items = matriculas.map(m => {
      const pagos = porMatricula.get(m.id) ?? []
      const motivo = motivoQueImpideSolicitar({
        enrollment_id: m.id,
        pagosDevolvibles: pagos.length,
        yaTieneDevolucion: pagos.some(id => conDevolucion.has(id)),
      })
      // OJO: `pagos` NO viaja. Se usa para decidir y se queda acá.
      return {
        enrollment_id: m.id,
        estudio: nombreDe(m),
        grupo: uno<{ name: string | null }>(m.grupo)?.name ?? null,
        estado: m.status,
        fecha: m.enrolled_at,
        motivo,
      }
    })
    return NextResponse.json({ items })
  } catch (error) {
    reportarError('GET /api/studies/refund-requests:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/** POST · Crea la solicitud. Nace en `pending`, que es donde finanzas la ve. */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRoles(...PUEDEN_SOLICITAR_DEVOLUCION)
    if (auth.res) return auth.res

    const parsed = solicitud.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    }
    const { enrollment_id, justificacion } = parsed.data

    // La misma validación que corre la pantalla, para que no pueda mandar algo
    // que el servidor rechaza.
    const malaJustificacion = validarJustificacion(justificacion)
    if (malaJustificacion) return NextResponse.json({ error: malaJustificacion }, { status: 400 })

    const supabase = createAdminClient()
    const { data: mat } = await supabase
      .from('study_enrollments')
      .select('id, member_id, status, enrolled_at, plan:study_plans(name), grupo:study_groups!study_enrollments_group_id_fkey(name)')
      .eq('id', enrollment_id).maybeSingle()
    if (!mat) return NextResponse.json({ error: 'La matrícula no existe' }, { status: 404 })
    const matricula = mat as unknown as MatriculaCruda

    const { porMatricula, conDevolucion } = await pagosDeLasMatriculas([enrollment_id])
    const pagos = porMatricula.get(enrollment_id) ?? []
    const motivo = motivoQueImpideSolicitar({
      enrollment_id,
      pagosDevolvibles: pagos.length,
      yaTieneDevolucion: pagos.some(id => conDevolucion.has(id)),
    })
    if (motivo) return NextResponse.json({ error: motivo }, { status: 409 })

    // Exactamente uno, garantizado por `motivoQueImpideSolicitar`.
    const paymentId = pagos[0]
    const { data: pago } = await supabase
      .from('payments').select('amount').eq('id', paymentId).maybeSingle()
    const monto = Number((pago as { amount: number } | null)?.amount ?? 0)
    if (!(monto > 0)) {
      return NextResponse.json(
        { error: 'El pago de esta matrícula no tiene monto. Pedísela a finanzas directamente.' },
        { status: 409 })
    }

    const { data: quien } = await supabase
      .from('members').select('first_name, last_name').eq('id', auth.ctx.memberId ?? '').maybeSingle()
    const nombre = quien
      ? `${(quien as { first_name: string }).first_name} ${(quien as { last_name: string }).last_name}`.trim()
      : 'coordinación de estudios'

    const creada = await createRefund({
      payment_id: paymentId,
      member_id: matricula.member_id,
      amount: monto,
      reason: razonDeLaSolicitud({
        justificacion, solicitanteNombre: nombre, estudio: nombreDe(matricula),
      }),
      sinpe_pending: false,
    })
    if (creada.code !== 'ok') {
      // El RPC ya validó estado y tope; si dice que no, se muestra su motivo
      // SIN el monto — quien pide no ve pagos.
      const humano = creada.code === 'not_refundable'
        ? 'El pago de esta matrícula no admite devolución.'
        : creada.code === 'exceeds'
          ? 'Ese pago ya fue devuelto. Consultalo con finanzas.'
          : 'No se pudo crear la solicitud.'
      return NextResponse.json({ error: humano }, { status: 409 })
    }

    if (auth.ctx.userId) {
      await logAudit({
        actorUserId: auth.ctx.userId,
        action: 'INSERT',
        entityType: 'refunds',
        entityId: creada.id,
        newData: {
          op: 'solicitud_devolucion_estudios',
          enrollment_id,
          member_id: matricula.member_id,
          solicitante_member_id: auth.ctx.memberId,
          justificacion,
        },
      })
    }

    // La respuesta NO lleva el monto ni el pago: la persona que pidió no los
    // vio antes y no los ve ahora.
    return NextResponse.json({ id: creada.id }, { status: 201 })
  } catch (error) {
    reportarError('POST /api/studies/refund-requests:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
