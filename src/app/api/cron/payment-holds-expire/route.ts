import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, secretsMatch } from '@/lib/auth/guard'
import { pingHealthcheck } from '@/lib/health'
import { expirePendingEventRegistrations } from '@/lib/supabase/queries/events'
import { expirePendingStudyEnrollments, avisarMatriculasPorVencer } from '@/lib/supabase/queries/studies'
import { reportarError } from '@/lib/observabilidad'

/** Autorizado con el CRON_SECRET (edge function diaria) o sesión de dirección. */
async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secretsMatch(bearer, process.env.CRON_SECRET)) return null
  const auth = await requireRoles('direccion', 'admin')
  return auth.res ?? null
}

// POST: libera cupos "atascados".
//
//  · EVENTOS: inscripciones pendientes cuyo comprobante fue rechazado hace más
//    de 72h sin resubir otro (payment_status='expired').
//  · ESTUDIOS: matrículas que quedaron a medio camino — 'pendiente_de_pago' sin
//    ningún comprobante después de la ventana de gracia.
//
// Lo de estudios volvió el 2026-09-01. Se había quitado el 2026-08-04, cuando
// la matrícula pasó a ser efectiva de inmediato y el pago un carril aparte: con
// esa regla nadie podía quedar desmatriculado por un pago sin resolver. Al
// revertirse esa regla —la matrícula con costo la confirma el comprobante— el
// barrido vuelve a hacer falta, porque si no, quien abandona el flujo deja el
// cupo tomado para siempre.
//
// NO toca las matrículas automáticas del cierre (N2-N4 y Discípulos): esas
// nacen 'enrolled' con su cobro aparte y pueden convivir con un pago pendiente.
// La condición es por ESTADO, justamente para que así sea.
export async function POST(req: NextRequest) {
  const denied = await authorize(req)
  if (denied) return denied
  try {
    /**
     * `?dry=1` → DRY-RUN: lista a quién soltaría y a quién avisaría HOY sin
     * escribir nada. Sirve para revisar el barrido contra datos reales antes de
     * dejarlo correr solo, y para entender por qué tocó a alguien.
     *
     * Va por PARÁMETRO y no por método: Vercel invoca este cron con GET (ver
     * `export const GET = POST` al final), así que un handler GET propio habría
     * suplantado la corrida de verdad.
     */
    if (new URL(req.url).searchParams.get('dry') === '1') {
      const [estudios, avisos] = await Promise.all([
        expirePendingStudyEnrollments(new Date(), { dryRun: true }),
        avisarMatriculasPorVencer(new Date(), { dryRun: true }),
      ])
      return NextResponse.json({ dry_run: true, soltaria_el_cupo: estudios.detalle, avisaria: avisos.detalle })
    }
    const events = await expirePendingEventRegistrations()
    const estudios = await expirePendingStudyEnrollments()
    // NOT-2: el aviso de "te quedan 24 horas" va DESPUÉS de expirar y en el
    // mismo barrido. Después, para no avisarle a quien en esta misma corrida ya
    // se quedó sin cupo; y en el mismo barrido porque comparte la consulta y el
    // reloj, así que un aviso y una baja nunca pueden discrepar sobre cuántas
    // horas pasaron.
    const avisos = await avisarMatriculasPorVencer()
    await pingHealthcheck('HEALTHCHECK_URL_PAYMENT_HOLDS_EXPIRE')
    return NextResponse.json({
      events_expired: events.expired,
      matriculas_expiradas: estudios.expired,
      avisos_enviados: avisos.avisados,
    })
  } catch (error) {
    reportarError('POST /api/cron/payment-holds-expire:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Los crons de Vercel invocan con GET (vercel.json); mismo handler.
export const GET = POST
