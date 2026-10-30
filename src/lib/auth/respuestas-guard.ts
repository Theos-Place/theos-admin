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

/**
 * ¿Esta sesión puede ver las respuestas de este formulario? La MISMA regla que
 * aplican las rutas, como booleano, para que una pantalla decida si ofrece el
 * enlace (FRM-8). Devuelve el motivo del 403 cuando no, por si hace falta.
 */
export async function puedeVerRespuestas(
  formId: string, ctx: AuthContext,
): Promise<{ puede: true } | { puede: false; motivo: string }> {
  const { data: formTitulo } = await createAdminClient()
    .from('forms').select('title').eq('id', formId).maybeSingle()
  const bloqueo = bloqueoPorReserva((formTitulo as { title: string } | null)?.title, ctx.roles)
  if (bloqueo) return { puede: false, motivo: bloqueo }
  const scope = formViewerScope({
    roles: ctx.roles,
    memberId: ctx.memberId,
    form: { id: formId },
    hasGrant: await hasFormAccessGrant(formId, ctx.memberId),
    isEventManager: await isManagerOfFormEvent(formId, ctx.memberId),
  })
  if (scope === 'none') return { puede: false, motivo: 'No autorizado' }
  return { puede: true }
}

export async function requireRespuestasDelFormulario(
  formId: string,
): Promise<{ ctx: AuthContext; res?: undefined } | { ctx?: undefined; res: NextResponse }> {
  const ctx = await getAuthContext()
  if (!ctx) return { res: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  const v = await puedeVerRespuestas(formId, ctx)
  if (!v.puede) return { res: NextResponse.json({ error: v.motivo }, { status: 403 }) }
  return { ctx }
}
