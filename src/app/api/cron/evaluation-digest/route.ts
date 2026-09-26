import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, secretsMatch } from '@/lib/auth/guard'
import { EVALUATION_ROLES } from '@/lib/auth/roles'
import { pingHealthcheck } from '@/lib/health'
import { enviarResumenDeEvaluaciones } from '@/lib/email/evaluation-digest-notify'
import { reportarError } from '@/lib/observabilidad'

/** Autorizado con el CRON_SECRET o por quien revisa evaluaciones —así se puede
 *  disparar a mano para ver qué diría, sin esperar al día 1 o al 15. */
async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secretsMatch(bearer, process.env.CRON_SECRET)) return null
  const auth = await requireRoles(...EVALUATION_ROLES)
  return auth.res ?? null
}

/**
 * RET-1 parte 6 · El resumen quincenal de evaluaciones que esperan revisión.
 *
 * POR QUÉ EXISTE, con el dato que lo motivó: al 2026-09-25 había 8 tiquetes,
 * los 8 en `open`, el más viejo de hace 34 días, y nadie había recibido un solo
 * aviso. La cola vive en `/estudios/evaluaciones` pero hay que acordarse de
 * entrar, y los 34 días dicen que no se entra.
 *
 * EL 1 Y EL 15, y no «cada 14 días». Cron no sabe de quincenas: un paso de 14
 * sobre el día del mes salta raro a fin de mes —del 29 vuelve al 1 con dos días
 * de diferencia—. Una fecha fija además se puede anticipar: quien revisa sabe
 * que el 1 y el 15 le llega la lista.
 *
 * NO MANDA NADA SI NO HAY PENDIENTES. La decisión vive en la regla pura, no
 * acá. Un resumen que llega diciendo «cero» enseña a archivarlo sin leer.
 *
 * NO MANDA CORREO: es una notificación interna. Lo que se está avisando es que
 * hay trabajo en una pantalla, no algo que se conteste desde la bandeja.
 */
export async function POST(req: NextRequest) {
  const denied = await authorize(req)
  if (denied) return denied
  try {
    const r = await enviarResumenDeEvaluaciones()
    await pingHealthcheck('HEALTHCHECK_URL_EVALUATION_DIGEST')
    return NextResponse.json({ ok: true, ...r })
  } catch (error) {
    reportarError('POST /api/cron/evaluation-digest:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
