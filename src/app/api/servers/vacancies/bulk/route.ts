import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import { setVacanciesStatus } from '@/lib/supabase/queries/servers'
import { isVacancyState } from '@/lib/servers/vacancy-states'

// POST: cambio de estado masivo de solicitudes de cupos (vacancies). Body:
// { status: 'enviado_lider'|'aprobado'|'denegado', ids: string[] }. No toca
// aplicaciones ni servidores (eso es el flujo de aplicaciones, 5b).
export async function POST(req: NextRequest) {
  const auth = await requireRoles(...SERVICE_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const { status, ids } = (await req.json()) as { status?: string; ids?: string[] }
    const list = Array.isArray(ids) ? ids.filter(Boolean) : []
    if (list.length === 0) return NextResponse.json({ error: 'No hay vacantes seleccionadas.' }, { status: 400 })
    if (!status || !isVacancyState(status) || status === 'creado') {
      return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 })
    }
    const { updated } = await setVacanciesStatus(list, status)
    return NextResponse.json({ ok: true, updated })
  } catch (error) {
    console.error('POST /api/servers/vacancies/bulk:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
