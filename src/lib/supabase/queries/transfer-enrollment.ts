import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  motivoQueImpideTransferir, pagosQueViajan, planDeDinero, notaDeTransferencia,
  type GrupoParaTransferir, type PagoConMonto,
} from '@/lib/studies/transferencia'

/**
 * Mover una matrícula de un grupo a otro, con su pago.
 *
 * UNA SOLA IMPLEMENTACIÓN. La mecánica vivía dentro de resolveStudyRequest,
 * para las reubicaciones. Ahora vive acá y la usan los dos caminos: la
 * resolución de un tiquete y la acción directa del coordinador. Si fueran dos
 * copias, en seis meses se comportarían distinto.
 *
 * Lo que hace, en orden y con las escrituras que pueden fallar primero:
 *   1. Valida contra las reglas puras (mismo idioma que la confirmación de la UI).
 *   2. Cierra la matrícula origen como 'transferred'.
 *   3. Abre la del destino como 'enrolled'.
 *   4. Re-enlaza los pagos vivos y ajusta la plata según el precio del destino.
 *
 * NO usa una transacción de base de datos porque PostgREST no las expone; el
 * orden está pensado para que un fallo a mitad deje el estado menos malo
 * posible, y cada paso que puede dejar basura la limpia.
 */
export type ResultadoTransferencia = {
  enrollment_id: string
  desde_grupo: string
  hacia_grupo: string
  pagos_movidos: number
  cobro_creado: number
  saldo_a_favor: number
  mensaje: string
}

export class TransferenciaBloqueada extends Error {
  constructor(public code: string, mensaje: string) {
    super(mensaje)
    this.name = 'TransferenciaBloqueada'
  }
}

async function leerGrupo(id: string): Promise<GrupoParaTransferir | null> {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('study_groups')
    .select('id, name, plan_id, max_students, status, plan:study_plans!study_groups_plan_id_fkey(cost, currency, code, level)')
    .eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const g = data as unknown as {
    id: string; name: string; plan_id: string | null; max_students: number | null; status: string | null
    plan: { cost: number | null; currency: string | null; code: string | null; level: string | null } | null
  }
  const { count } = await sb.from('study_enrollments')
    .select('id', { count: 'exact', head: true }).eq('group_id', id).eq('status', 'enrolled')
  return {
    id: g.id, name: g.name, plan_id: g.plan_id, status: g.status ?? '',
    plan_level: g.plan?.level ?? null, plan_code: g.plan?.code ?? null,
    costo: Number(g.plan?.cost ?? 0), currency: g.plan?.currency ?? 'CRC',
    max_students: g.max_students, inscritos: count ?? 0,
  }
}

export async function transferEnrollment(input: {
  memberId: string
  desdeGroupId: string
  haciaGroupId: string
  /** Quién lo hace: va en la traza del pago. */
  actorMemberId: string | null
  actorNombre: string
  /**
   * ¿Se le cobra la diferencia si el destino es más caro?
   *
   * true (default) para la acción directa del coordinador: mover a alguien a
   * un estudio de ₡20.000 habiendo pagado ₡5.000 deja ₡15.000 por cobrar.
   *
   * false para las REUBICACIONES, que conservan su regla: cambiar de grupo
   * porque el sistema o el horario obligaron no es motivo para cobrarle más
   * a la persona (decisión 2026-09-08, caso Valeria Astorga). El pago igual
   * viaja; lo que no se genera es el cobro extra.
   */
  cobrarDiferencia?: boolean
}): Promise<ResultadoTransferencia> {
  const sb = createAdminClient()
  const { memberId, desdeGroupId, haciaGroupId, actorMemberId, actorNombre } = input
  const cobrarDiferencia = input.cobrarDiferencia ?? true

  const [origen, destino] = await Promise.all([leerGrupo(desdeGroupId), leerGrupo(haciaGroupId)])
  if (!origen) throw new TransferenciaBloqueada('origen_no_existe', 'El grupo de origen no existe.')
  if (!destino) throw new TransferenciaBloqueada('destino_no_existe', 'El grupo destino no existe.')

  const { data: enDestino } = await sb.from('study_enrollments')
    .select('id, status').eq('group_id', haciaGroupId).eq('member_id', memberId).maybeSingle()
  const previa = enDestino as { id: string; status: string } | null

  const impedimento = motivoQueImpideTransferir({ origen, destino, estadoEnDestino: previa?.status })
  if (impedimento) throw new TransferenciaBloqueada(impedimento.code, impedimento.mensaje)

  // La matrícula que se mueve tiene que existir y estar viva.
  const { data: actual } = await sb.from('study_enrollments')
    .select('id, status').eq('group_id', desdeGroupId).eq('member_id', memberId).maybeSingle()
  const origenEnr = actual as { id: string; status: string } | null
  if (!origenEnr) throw new TransferenciaBloqueada('sin_matricula', 'La persona no está matriculada en el grupo de origen.')
  if (!['enrolled', 'pendiente_de_pago', 'waitlist', 'en_revision'].includes(origenEnr.status)) {
    throw new TransferenciaBloqueada('matricula_inactiva',
      `Su matrícula en ${origen.name} está en «${origenEnr.status}»: no hay nada activo que mover.`)
  }

  // 1. Cerrar el origen ANTES de abrir el destino. Si esto falla, se aborta:
  //    al revés, entre los dos pasos, la persona quedaría activa en dos grupos.
  const { error: cerrarErr } = await sb.from('study_enrollments')
    .update({ status: 'transferred', transferred_to: haciaGroupId, updated_at: new Date().toISOString() })
    .eq('id', origenEnr.id)
  if (cerrarErr) throw cerrarErr

  // 2. Abrir el destino. Upsert por (group, member): re-activa una fila vieja
  //    de alguien que ya había pasado por ahí y se retiró.
  const { data: nueva, error: abrirErr } = await sb.from('study_enrollments')
    .upsert({
      member_id: memberId, group_id: haciaGroupId, plan_id: destino.plan_id,
      status: 'enrolled', enrolled_at: new Date().toISOString(),
      dropped_at: null, drop_reason: null, transferred_to: null,
    }, { onConflict: 'group_id,member_id' })
    .select('id').single()
  if (abrirErr) {
    // Devolver el origen a como estaba: sin esto la persona queda sin grupo.
    await sb.from('study_enrollments')
      .update({ status: origenEnr.status, transferred_to: null }).eq('id', origenEnr.id)
    throw abrirErr
  }
  const nuevaId = (nueva as { id: string }).id

  // 3. La plata.
  const { data: pagosRaw } = await sb.from('payments')
    .select('id, status, review_status, concept, amount')
    .eq('member_id', memberId).eq('enrollment_id', origenEnr.id)
  const viajan = pagosQueViajan((pagosRaw ?? []) as PagoConMonto[]) as PagoConMonto[]
  const plan = planDeDinero({ pagos: viajan, costoDestino: destino.costo, moneda: destino.currency })

  const nota = notaDeTransferencia({
    desde: origen.name, hacia: destino.name, quien: actorNombre, cuando: new Date(),
  })
  for (const pagoId of plan.mover) {
    const parche = {
      enrollment_id: nuevaId,
      study_group_id: haciaGroupId,
      transfer_note: nota,
      description: `Matrícula · ${destino.name}`,
      updated_at: new Date().toISOString(),
      ...(plan.ajustar?.id === pagoId ? { amount: plan.ajustar.monto } : {}),
    }
    const { error } = await sb.from('payments').update(parche).eq('id', pagoId)
    if (error) console.error('transferEnrollment: no se pudo mover el pago', pagoId, error.message)
  }

  if (plan.cobrar > 0 && cobrarDiferencia) {
    const { error } = await sb.from('payments').insert({
      member_id: memberId, amount: plan.cobrar, currency: destino.currency ?? 'CRC',
      payment_method: 'comprobante', concept: 'matricula', entity_type: 'study_group',
      enrollment_id: nuevaId, study_group_id: haciaGroupId, status: 'pending',
      description: `Diferencia por cambio de grupo · ${destino.name}`,
      transfer_note: notaDeTransferencia({
        desde: origen.name, hacia: destino.name, quien: actorNombre, cuando: new Date(),
        esDiferencia: true,
      }),
    })
    if (error) console.error('transferEnrollment: no se pudo crear el cobro de la diferencia:', error.message)
  }

  void actorMemberId

  // Los tres avisos. Best-effort y AL FINAL: el traslado ya está hecho y no se
  // deshace porque un correo falle.
  try {
    const { notifyTraslado } = await import('@/lib/email/traslado-notify')
    await notifyTraslado({
      memberId, desdeGroupId, haciaGroupId,
      cobroPendiente: cobrarDiferencia ? plan.cobrar : 0,
      saldoAFavor: plan.saldoAFavor,
      moneda: destino.currency,
    })
  } catch (e) {
    console.warn('transferEnrollment: los avisos fallaron:', e instanceof Error ? e.message : e)
  }

  return {
    enrollment_id: nuevaId,
    desde_grupo: origen.name,
    hacia_grupo: destino.name,
    pagos_movidos: plan.mover.length,
    cobro_creado: cobrarDiferencia ? plan.cobrar : 0,
    saldo_a_favor: plan.saldoAFavor,
    mensaje: !cobrarDiferencia && plan.cobrar > 0
      ? 'Su pago se traslada a la matrícula nueva. No se le cobra la diferencia: es una reubicación.'
      : plan.mensaje,
  }
}
