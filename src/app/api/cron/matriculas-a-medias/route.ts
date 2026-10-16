import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, secretsMatch } from '@/lib/auth/guard'
import { avisarMatriculasApartadas } from '@/lib/supabase/queries/aviso-matricula-apartada'
import { reportarError } from '@/lib/observabilidad'
import { pingHealthcheck } from '@/lib/health'

/**
 * CRON · MAT-4 · Avisa a quien dejó la matrícula a medias, el mismo día.
 *
 * POR QUÉ UN CRON APARTE y no dentro de `payment-holds-expire`, que ya mira
 * los mismos pagos: aquel corre UNA VEZ AL DÍA y hace cuatro cosas más
 * —expirar reservas de eventos y de estudios, el aviso de 24 horas, el de
 * cobros huérfanos—. Subirle la frecuencia para que este aviso llegue a
 * tiempo arrastraría a las otras cuatro, y el de cobros huérfanos pasaría de
 * un aviso al día a uno por hora.
 *
 * Este corre cada hora y hace una sola cosa, que además es barata: una
 * consulta a las matrículas en `pendiente_de_pago`, que son un puñado.
 *
 * El dedupe vive en la campanita, así que correrlo de más no manda dos.
 */
/** El MISMO gate que el resto de los crons: CRON_SECRET o sesión de
 *  dirección. Sin esto, cualquiera podría disparar correos a la gente. */
async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secretsMatch(bearer, process.env.CRON_SECRET)) return null
  const auth = await requireRoles('direccion', 'admin')
  return auth.res ?? null
}

export async function POST(req: NextRequest) {
  const no = await authorize(req)
  if (no) return no
  try {
    // `?dry=1` para ver a quién tocaría sin mandar nada. Va por parámetro y no
    // por método porque Vercel invoca los crons con GET.
    if (new URL(req.url).searchParams.get('dry') === '1') {
      const r = await avisarMatriculasApartadas(new Date(), { dryRun: true })
      return NextResponse.json({ dry_run: true, avisaria: r.detalle })
    }
    const r = await avisarMatriculasApartadas()
    // El monitor se da de alta junto con este cambio (2026-10-16). Sin la
    // variable, el ping solo deja un aviso en el log: el cron no falla.
    await pingHealthcheck('HEALTHCHECK_URL_MATRICULAS_A_MEDIAS')
    return NextResponse.json({ avisos_enviados: r.avisados, detalle: r.detalle })
  } catch (error) {
    reportarError('POST /api/cron/matriculas-a-medias:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export const GET = POST
