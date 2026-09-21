import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { alcanceDeEventosDeLaSesion } from '@/lib/auth/event-guard'
import { EVENT_WRITE_ROLES } from '@/lib/auth/roles'
import { getEvents, createEvent } from '@/lib/supabase/queries/events'
import { formToWriteInput, formToSubEvents, formToOrganizingCommittees } from '@/lib/events/form-mapper'
import { problemaDeLaSerie, impideGuardar, mensajeDelProblema } from '@/lib/events/fin-de-la-serie'
import type { EventType, EventStatus } from '@/types/event'
import { reportarError } from '@/lib/observabilidad'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireModuleView('eventos')
    if (auth.res) return auth.res
    const { searchParams } = req.nextUrl
    const search     = searchParams.get('search')     ?? undefined
    const event_type = searchParams.get('event_type') ?? undefined
    const status     = searchParams.get('status')     ?? undefined
    const is_active  = searchParams.get('is_active')
    // Clamp (como /api/members): NaN o valores fuera de rango rompen .range().
    const rawPage     = Number(searchParams.get('page') ?? 1)
    const rawPageSize = Number(searchParams.get('pageSize') ?? 100)
    const page     = Number.isFinite(rawPage)     ? Math.max(1, Math.trunc(rawPage)) : 1
    const pageSize = Number.isFinite(rawPageSize) ? Math.min(1000, Math.max(1, Math.trunc(rawPageSize))) : 100

    const result = await getEvents({
      search,
      event_type: event_type as EventType | undefined,
      status:     status as EventStatus | undefined,
      is_active:  is_active === 'all' ? 'all' : is_active !== null ? is_active === 'true' : true,
      light:      searchParams.get('light') === '1',
      page,
      pageSize,
    })

    return NextResponse.json(result)
  } catch (error) {
    reportarError('GET /api/events:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRoles(...EVENT_WRITE_ROLES)
    if (auth.res) return auth.res
    const body = await req.json()
    const comites = formToOrganizingCommittees(body)
    /**
     * EVE-12: quien tiene el rol por su PUESTO no puede crear un evento a
     * nombre de otro comité. Sin esto, la regla del guard se esquiva sola:
     * bastaba crear el evento poniendo "Sede Cartago" de organizador para
     * después poder operarlo… o para dejárselo firmado a otra sede.
     *
     * Se RECHAZA en vez de recortar la lista en silencio: un evento con un
     * organizador distinto del que la persona eligió es peor que un error.
     */
    const alcance = await alcanceDeEventosDeLaSesion(auth.ctx)
    if (alcance.alcance === 'comites') {
      const ajenos = comites.filter(c => !alcance.comites.includes(c))
      if (ajenos.length || comites.length === 0) {
        return NextResponse.json({
          error: comites.length === 0
            ? 'Elegí el comité organizador: solo podés crear eventos para tus comités.'
            : 'Solo podés crear eventos para tus propios comités.',
          code: 'otro_comite',
        }, { status: 403 })
      }
    }
    const entrada = formToWriteInput(body)
    // La misma regla que avisa en el formulario, también acá: una serie que
    // termina antes de empezar no crea ninguna repetición y el evento se ve una
    // sola vez, sin nada que lo explique (2026-09-21).
    const problema = problemaDeLaSerie(entrada.is_recurring ?? false, entrada.starts_at, entrada.recurrence_end)
    if (impideGuardar(problema)) {
      return NextResponse.json({ error: mensajeDelProblema(problema) }, { status: 400 })
    }
    const event = await createEvent(entrada, formToSubEvents(body), auth.ctx.userId, comites)
    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    reportarError('POST /api/events:', error)
    // Propaga el mensaje real (ej. FK de event_type, columna faltante) para que
    // el formulario lo muestre en vez de redirigir como si hubiera guardado.
    const msg = (error as { message?: string })?.message ?? 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
