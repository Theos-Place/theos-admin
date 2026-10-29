/**
 * FRM-9 · Quién puede LEER (y por tanto corregir el vínculo de) las respuestas
 * de un formulario. Es la regla que vivía inline en GET /api/forms/[id]/responses;
 * ahora la comparten esa ruta, la de respuestas sin ficha y el PATCH del vínculo.
 */
import { NextResponse } from 'next/server'
import { getAuthContext, type AuthContext } from '@/lib/auth/guard'
import { formViewerScope } from '@/lib/auth/forms-scope'
import { bloqueoPorReserva } from '@/lib/forms/formularios-reservados'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasFormAccessGrant } from '@/lib/supabase/queries/forms'
import { isManagerOfFormEvent } from '@/lib/supabase/queries/events'

export async function requireRespuestasDelFormulario(
  formId: string,
): Promise<{ ctx: AuthContext; res?: undefined } | { ctx?: undefined; res: NextResponse }> {
  const ctx = await getAuthContext()
  if (!ctx) return { res: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  const { data: formTitulo } = await createAdminClient()
    .from('forms').select('title').eq('id', formId).maybeSingle()
  const bloqueo = bloqueoPorReserva((formTitulo as { title: string } | null)?.title, ctx.roles)
  if (bloqueo) return { res: NextResponse.json({ error: bloqueo }, { status: 403 }) }
  const scope = formViewerScope({
    roles: ctx.roles,
    memberId: ctx.memberId,
    form: { id: formId },
    hasGrant: await hasFormAccessGrant(formId, ctx.memberId),
    isEventManager: await isManagerOfFormEvent(formId, ctx.memberId),
  })
  if (scope === 'none') return { res: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  return { ctx }
}
