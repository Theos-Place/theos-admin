import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { alcanceDeEventosDeLaSesion } from '@/lib/auth/event-guard'
import { reportarError } from '@/lib/observabilidad'

/**
 * EVE-12 · Hasta dónde llega el rol de eventos de quien está en sesión.
 *
 * Lo usa la pantalla para no ofrecer lo que el servidor va a negar: el botón de
 * check-in en un evento de otra sede, o el selector de comités organizadores al
 * crear. La regla de verdad vive en `requireEventAccess`; esto es cortesía.
 *
 * Solo habla del alcance de UNO MISMO, así que no hace falta más que sesión.
 */
export async function GET() {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    return NextResponse.json(await alcanceDeEventosDeLaSesion(auth.ctx))
  } catch (error) {
    reportarError('GET /api/events/mi-alcance:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
