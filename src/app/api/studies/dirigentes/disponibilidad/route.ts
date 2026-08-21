import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validate'
import {
  getAvailabilityForms, getLeaderAvailabilityResponses,
} from '@/lib/supabase/queries/leader-availability'
import { canSeeLeaderAdminStatus, visibleLeaderStatus } from '@/lib/studies/leader-admin-status'

// DIR-1 · Insumo del coordinador de dirigentes: las respuestas del formulario de
// disponibilidad con el estado actual de cada dirigente. SOLO LECTURA — nada de
// esto actualiza al dirigente; el coordinador decide y aplica los cambios con
// los flujos de /estudios/dirigentes.
const VIEW_ROLES = ['coordinador_dirigentes', 'coordinador_estudios', 'direccion', 'admin'] as const

export async function GET(req: NextRequest) {
  const auth = await requireRoles(...VIEW_ROLES)
  if (auth.res) return auth.res
  try {
    const formId = req.nextUrl.searchParams.get('form_id')
    const forms = await getAvailabilityForms()
    // Sin form_id se usa el más reciente: es el ciclo en curso.
    const target = formId && isUuid(formId) ? formId : forms[0]?.id ?? null
    const rows = target ? await getLeaderAvailabilityResponses(target) : []
    // DIR-6: 'direccion' entra a esta pantalla pero NO ve el matiz — para ella
    // un dirigente en pausa o en revisión es simplemente inactivo.
    const verMatiz = canSeeLeaderAdminStatus(auth.ctx.roles)
    const saneadas = verMatiz ? rows : rows.map(r => ({
      ...r,
      leader: r.leader
        ? { ...r.leader, availability_status: visibleLeaderStatus(r.leader.availability_status, false) }
        : r.leader,
    }))
    return NextResponse.json({ forms, form_id: target, rows: saneadas })
  } catch (error) {
    console.error('GET /api/studies/dirigentes/disponibilidad:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
