import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, secretsMatch } from '@/lib/auth/guard'
import { pingHealthcheck } from '@/lib/health'
import { createAdminClient } from '@/lib/supabase/admin'
import { shouldCloseEnrollment } from '@/lib/studies/enrollment-window'
import { pedirFolletosAnticipadosAutomaticos, actualizarFolletoAlAbrir, barrerCierresDeMatriculaDeContinuacion } from '@/lib/supabase/queries/folletos'
import { ymdCR } from '@/lib/format'
import { reportarError } from '@/lib/observabilidad'

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

    /**
     * EST-30 · ANTES de cerrar ventanas: los Nivel 1 a dos semanas del fin
     * de matrícula piden sus folletos al cupo máximo. Va primero para que un
     * grupo que hoy mismo cierra y abre reciba el tiquete y, abajo, su
     * número final. Si falla, el cierre de ventanas sigue: son cosas
     * distintas y una no debe tapar la otra.
     */
    let anticipados: Awaited<ReturnType<typeof pedirFolletosAnticipadosAutomaticos>> | null = null
    try {
      anticipados = await pedirFolletosAnticipadosAutomaticos(today)
    } catch (e) {
      reportarError('group-enrollment-windows: folletos anticipados automáticos:', e)
    }

    /**
     * EST-31 · También antes de cerrar ventanas: el sucesor de un corte N2→N3
     * cuya matrícula venció ayer actualiza su tiquete de folletos con el
     * total final y el delta, avisa a folletos y al dirigente si entró
     * alguien. Va aparte del cierre de ventana porque ese espera al
     * arranque, y quien imprime necesita el número ANTES.
     */
    let continuaciones: Awaited<ReturnType<typeof barrerCierresDeMatriculaDeContinuacion>> = []
    try {
      continuaciones = await barrerCierresDeMatriculaDeContinuacion(today)
    } catch (e) {
      reportarError('group-enrollment-windows: cierres de matrícula de continuación:', e)
    }

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

    // Este cron ya NO pide folletos por 'fin_matricula' (decisión 2026-09-02:
    // exigía enrollment_end_date y casi ningún grupo la tenía). Lo que SÍ hace
    // desde EST-30 es cerrar el ciclo del anticipado: el grupo abrió, el
    // tiquete que se pidió al cupo recibe su número final.
    let folletosActualizados = 0
    for (const id of toClose) {
      try {
        if (await actualizarFolletoAlAbrir(id, today)) folletosActualizados++
      } catch (e) {
        reportarError(`group-enrollment-windows: folleto al abrir ${id}:`, e)
      }
    }

    await pingHealthcheck('HEALTHCHECK_URL_GROUP_WINDOWS')
    return NextResponse.json({ closed, anticipados, folletosActualizados, continuaciones })
  } catch (error) {
    reportarError('POST /api/cron/group-enrollment-windows:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Los crons de Vercel invocan con GET (vercel.json); mismo handler.
export const GET = POST
