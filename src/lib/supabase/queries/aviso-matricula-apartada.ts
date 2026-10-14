import { createAdminClient } from '@/lib/supabase/admin'
import { formatMoney } from '@/lib/format'
import { HORAS_DE_GRACIA } from '@/lib/studies/enrollment-hold'
import { reportarError } from '@/lib/observabilidad'

/**
 * MAT-4 · «Te apartamos el campo, falta el comprobante», el mismo día.
 *
 * POR QUÉ EXISTE. El aviso de las 24 horas lo manda un cron que corre una
 * vez al día a las 10:00, así que quien se matricula a las 10:15 recibe su
 * primer correo casi 48 horas después, con el plazo medio consumido. Los
 * cuatro de «N1 — Escazú» del 12 de octubre llevaban 32 horas sin que les
 * hubiera llegado nada.
 *
 * NO SALE AL MATRICULARSE, y esa es la corrección que pidió Floriana: en el
 * flujo normal la persona se matricula y sube el comprobante seguido, así
 * que un correo disparado en ese instante le llegaría también a quien hizo
 * todo bien treinta segundos después. Es el mismo error por el que se quitó
 * el aviso del 2026-09-01.
 *
 * SALE CUANDO LA DEJÓ A MEDIAS DE VERDAD: pasados {@link MINUTOS_PARA_AVISAR}
 * minutos sin comprobante. A esa altura ya cerró el sistema y se fue —el
 * modal de advertencia al salir ya se lo dijo en pantalla; esto es para
 * cuando ya no está mirando—.
 *
 * SE REGISTRA LA CAMPANITA ANTES DEL CORREO, igual que el aviso de 24
 * horas: la campanita es el registro de que ya se avisó. Si se mandara
 * primero el correo y la campanita fallara, una corrida posterior podría
 * mandar dos.
 */
export const TIPO_APARTADA = 'matricula_apartada'

/**
 * Cuánto se espera antes de dar por abandonada la matrícula.
 *
 * 30 minutos: suficiente para que quien está pagando en ese momento
 * —abrir la app del banco, hacer el SINPE, volver, adjuntar la imagen—
 * termine sin recibir un correo diciéndole que le falta algo. Y lo bastante
 * corto para que quien se fue lo lea el mismo día, no al otro.
 */
export const MINUTOS_PARA_AVISAR = 30

/**
 * Barre las matrículas que quedaron a medias y avisa a quien corresponda.
 *
 * Lo llama el cron. Devuelve el detalle para poder correrlo en seco.
 */
export async function avisarMatriculasApartadas(
  ahora: Date = new Date(),
  opts: { dryRun?: boolean } = {},
): Promise<{ avisados: number; detalle: Array<{ member_id: string; grupo: string; minutos: number }> }> {
  const supabase = createAdminClient()
  const corte = new Date(ahora.getTime() - MINUTOS_PARA_AVISAR * 60_000).toISOString()

  // Las candidatas: matrícula a medias, con su cobro de matrícula y sin
  // comprobante. El `lte` sobre el cobro y no sobre la matrícula porque el
  // reloj del plazo es el del cobro (el mismo que usa el barrido de 72 h).
  const { data, error } = await supabase
    .from('study_enrollments')
    .select(`id, member_id, group_id,
             members!study_enrollments_member_id_fkey!inner(first_name, last_name, email),
             study_groups!study_enrollments_group_id_fkey!inner(name),
             payments(id, concept, amount, currency, review_status, payment_plan_id, created_at)`)
    .eq('status', 'pendiente_de_pago')
  if (error) throw error

  type Fila = {
    id: string; member_id: string; group_id: string
    members: { first_name: string | null; last_name: string | null; email: string | null } | null
    study_groups: { name: string | null } | null
    payments: Array<{
      id: string; concept: string | null; amount: number | null; currency: string | null
      review_status: string | null; payment_plan_id: string | null; created_at: string
    }> | null
  }

  const detalle: Array<{ member_id: string; grupo: string; minutos: number }> = []
  let avisados = 0

  for (const f of (data ?? []) as unknown as Fila[]) {
    const matricula = (f.payments ?? []).filter(p => p.concept === 'matricula')
    if (matricula.length === 0) continue
    // Ya subió algo, o tiene plan de pagos: no debe nada todavía.
    if (matricula.some(p => p.review_status)) continue
    if (matricula.some(p => p.payment_plan_id)) continue

    const nacio = matricula
      .map(p => new Date(p.created_at).getTime())
      .reduce((a, b) => Math.min(a, b))
    if (nacio > new Date(corte).getTime()) continue  // todavía está en eso

    const minutos = Math.round((ahora.getTime() - nacio) / 60_000)
    const grupo = f.study_groups?.name ?? 'tu estudio'
    detalle.push({ member_id: f.member_id, grupo, minutos })
    if (opts.dryRun) continue

    const r = await avisarUna({
      supabase, memberId: f.member_id, enrollmentId: f.id,
      nombre: `${f.members?.first_name ?? ''} ${f.members?.last_name ?? ''}`.trim(),
      correo: f.members?.email ?? null,
      nombreGrupo: grupo,
      monto: matricula.reduce((total, p) => total + Number(p.amount ?? 0), 0),
      moneda: matricula[0]?.currency ?? null,
    })
    if (r.ok) avisados++
  }

  return { avisados, detalle }
}

/** Un aviso. Separado para que el barrido se lea de corrido. */
async function avisarUna(input: {
  supabase: ReturnType<typeof createAdminClient>
  memberId: string
  enrollmentId: string
  nombre: string
  correo: string | null
  nombreGrupo: string
  monto: number
  /** INT-3: el cobro puede no estar en colones. */
  moneda: string | null
}): Promise<{ ok: boolean; motivo?: string }> {
  const { supabase } = input
  const link = `/mis-pagos?enrollment=${input.enrollmentId}`

  // Una sola vez por matrícula. Si alguien pierde el cupo y se vuelve a
  // matricular, es otro enrollment y vuelve a avisar.
  const { data: yaHay } = await supabase
    .from('internal_notifications')
    .select('id')
    .eq('recipient_member_id', input.memberId)
    .eq('type', TIPO_APARTADA)
    .eq('link', link)
    .maybeSingle()
  if (yaHay) return { ok: false, motivo: 'ya avisado' }

  const { error: nErr } = await supabase.from('internal_notifications').insert({
    recipient_member_id: input.memberId,
    type: TIPO_APARTADA,
    title: 'Te apartamos tu campo — falta el comprobante',
    body: `Tu campo en ${input.nombreGrupo} está apartado. Subí el comprobante dentro de `
      + `${HORAS_DE_GRACIA} horas para confirmarlo.`,
    link,
  })
  if (nErr) {
    reportarError('avisarMatriculaApartada (campanita):', nErr)
    return { ok: false, motivo: nErr.message }
  }

  // Sin correo en la ficha no hay nada más que hacer: la campanita ya quedó.
  if (!input.correo) return { ok: true, motivo: 'sin correo' }

  const { sendSystemEmail } = await import('@/lib/email/system-templates')
  await sendSystemEmail({
    systemKey: 'matricula_apartada',
    to: { email: input.correo, name: input.nombre },
    data: {
      nombre: input.nombre,
      nombre_grupo: input.nombreGrupo,
      monto: formatMoney(input.monto, input.moneda),
      horas_de_plazo: String(HORAS_DE_GRACIA),
      link_pago: link,
    },
  })
  return { ok: true }
}
