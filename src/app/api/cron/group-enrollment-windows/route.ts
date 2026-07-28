import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, secretsMatch } from '@/lib/auth/guard'
import { pingHealthcheck } from '@/lib/health'
import { createAdminClient } from '@/lib/supabase/admin'
import { shouldCloseEnrollment } from '@/lib/studies/enrollment-window'
import { ymdCR } from '@/lib/format'
import { createAutoFolletoIfNeeded } from '@/lib/supabase/queries/folletos'

/** Autorizado con el CRON_SECRET o sesión de coordinación/dirección. */
async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secretsMatch(bearer, process.env.CRON_SECRET)) return null
  const auth = await requireRoles('coordinador_estudios', 'direccion', 'admin')
  return auth.res ?? null
}

// POST: cierre automático de matrícula por ventana (GRU-1). Un grupo
// en_matricula cuya enrollment_end_date ya pasó Y cuya fecha de inicio llegó
// pasa a en_curso. El cambio manual manda: solo se transiciona desde el estado
// esperado (en_matricula) y nunca se re-abre un grupo. La "apertura" no
// necesita cron: la ventana en la elegibilidad hace que el grupo aparezca en
// matrícula el día de enrollment_start_date (los grupos no tienen un estado
// previo a en_matricula).
export async function POST(req: NextRequest) {
  const denied = await authorize(req)
  if (denied) return denied
  try {
    const supabase = createAdminClient()
    const today = ymdCR()
    const { data, error } = await supabase
      .from('study_groups')
      .select('id, status, enrollment_end_date, starts_at')
      .eq('status', 'en_matricula')
      .not('enrollment_end_date', 'is', null)
      .lt('enrollment_end_date', today)
    if (error) throw error

    const rows = (data ?? []) as Array<{ id: string; status: string; enrollment_end_date: string | null; starts_at: string | null }>
    const toClose = rows.filter(g => shouldCloseEnrollment(g, today)).map(g => g.id)

    let closed = 0
    for (let i = 0; i < toClose.length; i += 100) {
      const slice = toClose.slice(i, i + 100)
      // Doble guard en el UPDATE: si alguien cambió el estado entre el SELECT y
      // acá, no se pisa (solo transiciona desde en_matricula).
      const { error: upErr, count } = await supabase
        .from('study_groups')
        .update({ status: 'en_curso' }, { count: 'exact' })
        .in('id', slice)
        .eq('status', 'en_matricula')
      if (upErr) throw upErr
      closed += count ?? 0
    }

    // FOL-1: al vencer la ventana de matrícula, tiquete de folletos si el
    // grupo tiene >= 5 matriculados (idempotente: índice único por grupo, así
    // que re-evaluar días siguientes no duplica; si el cupo ya lo generó,
    // tampoco). Best-effort por grupo.
    let folletos = 0
    const { data: ended } = await supabase
      .from('study_groups')
      .select('id')
      .not('enrollment_end_date', 'is', null)
      .lt('enrollment_end_date', today)
      .neq('status', 'finalizado')
    for (const g of (ended ?? []) as Array<{ id: string }>) {
      try {
        const r = await createAutoFolletoIfNeeded(g.id, 'fin_matricula', today)
        if (r.created) folletos++
      } catch (e) { console.warn('folleto fin_matricula:', e) }
    }

    await pingHealthcheck('HEALTHCHECK_URL_GROUP_WINDOWS')
    return NextResponse.json({ closed, folletos_creados: folletos })
  } catch (error) {
    console.error('POST /api/cron/group-enrollment-windows:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Los crons de Vercel invocan con GET (vercel.json); mismo handler.
export const GET = POST
