import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { EVENT_CHECKIN_ROLES } from '@/lib/auth/roles'
import { isUuid } from '@/lib/validate'
import { CAMPOS_CORRECCION_CHECKIN, camposRechazados, soloCamposPermitidos } from '@/lib/members/alta-desde-checkin'

/**
 * PATCH /api/events/[id]/members/[memberId] — corregir el documento o el
 * teléfono de alguien DESDE la fila del evento.
 *
 * Por qué existe: cuando la pantalla de check-in avisa "a esta persona le falta
 * la cédula", el equipo de bienvenida la pedía y no se guardaba. El PATCH
 * general de /api/members/[id] exige roles de padrón (o ser la propia persona),
 * y encargado_eventos no los tiene: devolvía 403 y la pantalla ni siquiera lo
 * mostraba, así que parecía que se había guardado.
 *
 * SOLO documento y teléfono (CAMPOS_CORRECCION_CHECKIN). Cualquier otro campo se
 * responde 400 nombrándolo. El correo queda afuera a propósito: cambiarlo mueve
 * el acceso a la cuenta, y eso no es una corrección de mostrador.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const auth = await requireRoles(...EVENT_CHECKIN_ROLES)
  if (auth.res) return auth.res
  try {
    const { id: eventId, memberId } = await params
    if (!isUuid(eventId)) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })
    if (!isUuid(memberId)) return NextResponse.json({ error: 'Persona no encontrada' }, { status: 404 })

    const crudo = await req.json().catch(() => null)
    const demas = camposRechazados(crudo, CAMPOS_CORRECCION_CHECKIN)
    if (demas.length) {
      return NextResponse.json(
        { error: `Desde el check-in solo se pueden corregir el documento y el teléfono. No: ${demas.join(', ')}.`, code: 'campo_no_permitido' },
        { status: 400 },
      )
    }
    const cambios = soloCamposPermitidos(crudo, CAMPOS_CORRECCION_CHECKIN)
    if (Object.keys(cambios).length === 0) {
      return NextResponse.json({ error: 'No mandaste ningún cambio.' }, { status: 400 })
    }

    const { createAdminClient } = await import('@/lib/supabase/admin')
    const sb = createAdminClient()
    const { data: evento } = await sb.from('events').select('id').eq('id', eventId).maybeSingle()
    if (!evento) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })

    const { getMemberForLookupById, findMemberByCedulaOrEmail, updateMember } = await import('@/lib/supabase/queries/members')
    const actual = await getMemberForLookupById(memberId)
    if (!actual) return NextResponse.json({ error: 'Persona no encontrada' }, { status: 404 })

    const updates: Record<string, unknown> = {}

    if ('phone' in cambios) {
      const { normalizePhoneOrNull } = await import('@/lib/phone')
      updates.phone = normalizePhoneOrNull((cambios.phone ?? null) as string | null)
    }

    if ('cedula' in cambios || 'document_type' in cambios) {
      const { isDocumentType, isValidDocument, documentFormatMessage } = await import('@/lib/cedula')
      const tipoCrudo = (cambios.document_type ?? actual.document_type ?? 'cedula') as string
      if (!isDocumentType(tipoCrudo)) {
        return NextResponse.json({ error: 'Tipo de documento inválido.', code: 'documento_invalido' }, { status: 400 })
      }
      const numero = 'cedula' in cambios
        ? String(cambios.cedula ?? '').trim().toUpperCase() || null
        : actual.cedula
      if (numero && !isValidDocument(tipoCrudo, numero)) {
        return NextResponse.json({ error: documentFormatMessage(tipoCrudo), code: 'documento_invalido' }, { status: 400 })
      }
      // Dedup por la pareja (tipo, número) — INT-1. Sin esto, corregir en la
      // fila crea justo el duplicado que la cédula existe para evitar.
      if (numero) {
        const choque = await findMemberByCedulaOrEmail(numero, null, memberId, tipoCrudo)
        if (choque) {
          const otra = await getMemberForLookupById(choque.id)
          const nombre = otra ? `${otra.first_name} ${otra.last_name}`.trim() : null
          return NextResponse.json({
            error: nombre
              ? `Ese documento ya es de ${nombre}. Si es la misma persona, hacele el check-in a esa ficha.`
              : 'Ese documento ya pertenece a otra persona.',
            code: 'duplicate',
            member: otra ? { id: otra.id, first_name: otra.first_name, last_name: otra.last_name } : { id: choque.id },
          }, { status: 409 })
        }
      }
      updates.cedula = numero
      updates.document_type = tipoCrudo
    }

    await updateMember(memberId, updates as Parameters<typeof updateMember>[1])
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PATCH /api/events/[id]/members/[memberId]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
