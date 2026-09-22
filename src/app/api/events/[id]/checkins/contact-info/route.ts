import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEventAccess } from '@/lib/auth/event-guard'
import { getCheckinExistente } from '@/lib/supabase/queries/events'
import {
  puedeGuardar, MENSAJE_RECHAZO, MENSAJE_CORREO_DUPLICADO,
  type FichaEnLaPuerta,
} from '@/lib/events/contacto-en-la-puerta'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import { reportarError } from '@/lib/observabilidad'

/**
 * CHK-5 · POST — llena el correo o el teléfono VACÍO de alguien a quien se le
 * acaba de hacer check-in.
 *
 * ES A PROPÓSITO UN ENDPOINT APARTE Y ANGOSTO. Los roles de la puerta no tienen
 * edición de miembros y no se les va a dar: lo que hace falta es poder llenar
 * dos campos, en el momento en que la persona está enfrente, y nada más. Por
 * eso acá no se puede cambiar el nombre, ni la cédula, ni la fecha, ni pisar un
 * valor que ya existe.
 *
 * Cuatro candados, y ninguno vive solo en la pantalla:
 *
 *  1. **El mismo permiso que el check-in.** `requireEventAccess(..., puerta)`
 *     ya incluye la regla por comité de EVE-12 y la del subevento de CHK-4.
 *  2. **Tiene que haber hecho check-in HOY en ESTE evento.** Si no, el endpoint
 *     sería una manera de editar a cualquiera del padrón desde la puerta.
 *  3. **El campo tiene que estar vacío y la persona ser adulta conocida.** La
 *     regla vive en `lib/events/contacto-en-la-puerta`, con sus tests.
 *  4. **Correo duplicado: 409 sin decir de quién.** El operador no ve el
 *     padrón (mismo criterio que DAT-10).
 *
 * NO crea cuenta de acceso y NO manda ningún correo: solo escribe el campo.
 */

const schema = z.object({
  member_id: z.string().uuid(),
  email: z.string().email().max(120).optional(),
  phone: z.string().min(6).max(30).optional(),
}).refine(d => d.email || d.phone, { message: 'Mandá al menos un dato' })

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireEventAccess(id, { puerta: true })
  if (auth.res) return auth.res

  try {
    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    const { member_id, email, phone } = parsed.data

    // Candado 2: sin check-in de hoy en este evento, no hay nada que hacer acá.
    if (!(await getCheckinExistente(id, member_id))) {
      return NextResponse.json(
        { error: 'Esa persona no tiene check-in de hoy en este evento.', code: 'sin_checkin' },
        { status: 409 },
      )
    }

    const supabase = createAdminClient()
    const { data: ficha } = await supabase
      .from('members')
      .select('id, email, phone, birth_date, datos_protegidos')
      .eq('id', member_id).eq('is_active', true).maybeSingle()
    if (!ficha) return NextResponse.json({ error: 'No se encontró la ficha.' }, { status: 404 })

    // Candado 3, campo por campo.
    const cambios: { email?: string; phone?: string } = {}
    for (const [campo, valor] of [['email', email], ['phone', phone]] as const) {
      if (valor === undefined) continue
      const v = puedeGuardar(ficha as FichaEnLaPuerta, campo, valor)
      if (!v.ok) {
        return NextResponse.json(
          { error: MENSAJE_RECHAZO[v.motivo], code: v.motivo },
          { status: v.motivo === 'vacio' ? 400 : 409 },
        )
      }
      cambios[campo] = valor.trim()
    }

    // Candado 4. La BD no tiene UNIQUE sobre email, así que se valida acá igual
    // que en el alta de miembros.
    if (cambios.email) {
      const { findMemberByCedulaOrEmail } = await import('@/lib/supabase/queries/members')
      const otra = await findMemberByCedulaOrEmail(null, cambios.email, member_id)
      if (otra) {
        return NextResponse.json(
          { error: MENSAJE_CORREO_DUPLICADO, code: 'correo_duplicado' },
          { status: 409 },
        )
      }
    }

    const { error } = await supabase.from('members').update(cambios).eq('id', member_id)
    if (error) throw error

    // Quién lo capturó y desde qué evento: sin el evento no se puede reconstruir
    // por qué alguien de la puerta escribió en una ficha.
    await logAudit({
      actorUserId: auth.ctx.userId,
      action: 'UPDATE',
      entityType: 'members',
      entityId: member_id,
      newData: { ...cambios, capturado_en_checkin: id },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    reportarError('POST /api/events/[id]/checkins/contact-info:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
