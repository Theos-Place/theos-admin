import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, secretsMatch } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { pingHealthcheck } from '@/lib/health'
import { ymdCR } from '@/lib/format'
import { ESTADO_EN_ESPERA, solicitudesADespertar, parcheAlDespertar } from '@/lib/studies/request-wait'
import { reportarError } from '@/lib/observabilidad'

/** Igual que el resto de los crons: CRON_SECRET, o sesión de coordinación para
 *  poder dispararlo a mano. */
async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secretsMatch(bearer, process.env.CRON_SECRET)) return null
  const auth = await requireRoles('coordinador_estudios', 'coordinador_dirigentes', 'direccion', 'admin')
  return auth.res ?? null
}

/**
 * REU-2 · Despierta las solicitudes en espera cuyo día llegó.
 *
 * SEMANAL, los lunes. Lo pidió así la reunión, y calza: la espera se mide en
 * semanas y meses, así que revisar a diario no adelantaría nada y sí agregaría
 * un cron más a la lista de cosas que pueden fallar en silencio. El costo es
 * que una solicitud puede despertar hasta seis días tarde — irrelevante para
 * algo que durmió tres meses.
 *
 * NO SE REUSÓ OTRO CRON. La opción era colgarse de `payment-reminders`, que ya
 * corre los lunes, pero eso ata una cola de estudios al horario de finanzas:
 * el día que alguien mueva el de pagos, las solicitudes dejan de despertar y
 * nadie relaciona una cosa con la otra.
 *
 * VUELVE A 'open' Y NO A 'in_review', aunque estuviera asignada cuando se
 * durmió: pasaron meses, y decir que alguien la está revisando cuando esa
 * persona ni se acuerda es peor que devolverla a la fila. El nombre de quien la
 * tenía se conserva en `reviewed_by`, así que no se pierde.
 *
 * AVISA POR CAMPANITA, no por correo, y al miembro NO se le avisa nada: quien
 * tiene que hacer algo es la coordinación.
 *
 * Idempotente: al despertar deja de estar en `en_espera` y ya no califica.
 */
export async function POST(req: NextRequest) {
  const denied = await authorize(req)
  if (denied) return denied
  try {
    const supabase = createAdminClient()
    const hoy = ymdCR()

    const { data: dormidas, error } = await supabase
      .from('study_requests')
      .select('id, status, wait_until, member_id')
      .eq('status', ESTADO_EN_ESPERA)
    if (error) throw error

    const filas = (dormidas ?? []) as Array<{
      id: string; status: string; wait_until: string | null; member_id: string
    }>
    const ids = solicitudesADespertar(filas, hoy)
    if (ids.length === 0) {
      await pingHealthcheck('HEALTHCHECK_URL_STUDY_REQUESTS_WAKE')
      return NextResponse.json({ ok: true, despertadas: 0 })
    }

    const ahora = new Date().toISOString()
    const { error: eUpd } = await supabase
      .from('study_requests')
      .update({
        status: 'open',
        // `reactivated_at` + limpiar el despertador. La regla está en
        // parcheAlDespertar, compartida con el despertar a mano: el vencimiento
        // por bloque cuenta desde ahí y no desde `created_at`, así que sin eso
        // el cron de vencimiento mataría en su próxima corrida justo la
        // solicitud que alguien decidió conservar (ver request-expiry).
        ...parcheAlDespertar(ahora),
        updated_at: ahora,
      })
      .in('id', ids)
      // Guard de carrera: si alguien la despertó a mano entre la lectura y el
      // update, gana la persona.
      .eq('status', ESTADO_EN_ESPERA)
    if (eUpd) throw eUpd

    // Historial: sin esto, la solicitud aparece 'Abierta' sin que nadie la haya
    // abierto, y el registro de por qué estaba esperando se corta ahí.
    const { error: eHist } = await supabase.from('study_request_status_history').insert(
      ids.map(id => ({
        request_id: id,
        from_status: ESTADO_EN_ESPERA,
        to_status: 'open',
        changed_by: null,
        notes: 'Volvió sola: se cumplió la fecha de espera.',
      })),
    )
    if (eHist) console.warn('study-requests-wake: historial falló:', eHist.message)

    const avisados = await avisarCoordinacion(supabase, ids.length)

    console.log('study-requests-wake:', ids.length, 'despertadas; avisados', avisados)
    await pingHealthcheck('HEALTHCHECK_URL_STUDY_REQUESTS_WAKE')
    return NextResponse.json({ ok: true, despertadas: ids.length, avisados })
  } catch (error) {
    reportarError('POST /api/cron/study-requests-wake:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/** Campanita a quien resuelve reubicaciones. UN aviso por corrida y no uno por
 *  solicitud: cinco notificaciones que dicen lo mismo se archivan sin leer. */
async function avisarCoordinacion(
  supabase: ReturnType<typeof createAdminClient>,
  cuantas: number,
): Promise<number> {
  const { data: roleRows } = await supabase
    .from('member_roles')
    .select('member_id, member:members!member_roles_member_id_fkey(is_active)')
    .in('role', ['coordinador_estudios', 'coordinador_dirigentes'])
    .eq('is_active', true)
  const dest = [...new Set(((roleRows ?? []) as unknown as Array<{
    member_id: string; member: { is_active: boolean } | { is_active: boolean }[] | null
  }>)
    .filter(r => (Array.isArray(r.member) ? r.member[0] : r.member)?.is_active === true)
    .map(r => r.member_id))]
  if (dest.length === 0) return 0

  const { error } = await supabase.from('internal_notifications').insert(dest.map(memberId => ({
    recipient_member_id: memberId,
    type: 'study_request_woke',
    title: cuantas === 1
      ? 'Una solicitud en espera volvió a la cola'
      : `${cuantas} solicitudes en espera volvieron a la cola`,
    body: 'Se cumplió la fecha que se les puso. Están de nuevo entre las abiertas.',
    link: '/estudios/solicitudes?tab=relocation',
  })))
  if (error) { console.warn('study-requests-wake: aviso falló:', error.message); return 0 }
  return dest.length
}
