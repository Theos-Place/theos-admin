import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { notifyAbsentLeaders } from '@/lib/supabase/queries/study-requests'

/** Autorizado si trae el CRON_SECRET (cron de Supabase) o sesión de coordinación. */
async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (process.env.CRON_SECRET && bearer === process.env.CRON_SECRET) return null
  const auth = await requireRoles('coordinador_dirigentes', 'coordinador_estudios', 'direccion')
  return auth.res ?? null
}

// POST: verifica dirigentes con grupo activo y >4 semanas sin check-in de
// charla, y notifica a los coordinadores de dirigentes (máx. 1/dirigente/semana).
// La invoca a diario la edge function process-email-queue.
export async function POST(req: NextRequest) {
  const denied = await authorize(req)
  if (denied) return denied
  try {
    const result = await notifyAbsentLeaders()
    return NextResponse.json(result)
  } catch (error) {
    console.error('POST /api/notifications/leader-absence-check:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
