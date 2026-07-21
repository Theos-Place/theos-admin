import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, secretsMatch } from '@/lib/auth/guard'
import { refreshReportSnapshots } from '@/lib/supabase/queries/reports'

// Cron nocturno (medianoche CR): recalcula los datasets pesados de reportes y los
// guarda en report_snapshots. Las páginas leen de esa caché en vez de re-agregar
// sobre 160k+ check-ins en cada carga. Autorizado con CRON_SECRET (bearer) o
// sesión de dirección/admin (para poder dispararlo a mano).
async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secretsMatch(bearer, process.env.CRON_SECRET)) return null
  const auth = await requireRoles('direccion', 'admin')
  return auth.res ?? null
}

// Los reportes agregan sobre tablas grandes; damos margen de tiempo.
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const denied = await authorize(req)
  if (denied) return denied
  try {
    const counts = await refreshReportSnapshots()
    return NextResponse.json({ ok: true, counts, refreshed_at: new Date().toISOString() })
  } catch (error) {
    console.error('GET /api/cron/report-snapshots:', error)
    return NextResponse.json({ error: 'Error refrescando snapshots de reportes' }, { status: 500 })
  }
}
