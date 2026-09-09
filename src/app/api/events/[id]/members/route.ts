import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { EVENT_CHECKIN_ROLES } from '@/lib/auth/roles'
import { isUuid } from '@/lib/validate'
import { CAMPOS_ALTA_CHECKIN, camposRechazados, soloCamposPermitidos } from '@/lib/members/alta-desde-checkin'

/**
 * POST /api/events/[id]/members — alta de una persona DESDE la fila del evento.
 *
 * Por qué existe: el POST general de /api/members exige roles de padrón, y
 * encargado_eventos no los tiene ni los va a tener. Pero es el rol que atiende
 * la fila, donde llega gente que no está en el sistema. Antes ese alta
 * devolvía 403 y no había forma de registrar a nadie nuevo.
 *
 * Está colgado de la ruta del evento a propósito: para usarlo hay que nombrar
 * un evento que existe, así que el permiso queda atado al contexto de check-in
 * de forma literal, no por convención. /api/members sigue como estaba —
 * encargado_eventos NO gana el padrón.
 *
 * Solo los campos de CAMPOS_ALTA_CHECKIN. Cualquier otro se responde 400 con el
 * nombre, en vez de ignorarlo callado y dejar a alguien creyendo que lo guardó.
 */

const schema = z.object({
  first_name: z.string().trim().min(1, 'Falta el nombre.'),
  last_name: z.string().trim().min(1, 'Faltan los apellidos.'),
  // El documento dejó de ser obligatorio (2026-09-09): FIN-2 lo pide después y
  // no se frena la fila por él. Si viene, se valida igual que en el alta normal.
  cedula: z.string().trim().nullish(),
  document_type: z.string().trim().nullish(),
  email: z.string().trim().nullish(),
  phone: z.string().trim().nullish(),
  birth_date: z.string().trim().nullish(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(...EVENT_CHECKIN_ROLES)
  if (auth.res) return auth.res
  try {
    const { id: eventId } = await params
    if (!isUuid(eventId)) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })

    const crudo = await req.json().catch(() => null)
    const demas = camposRechazados(crudo, CAMPOS_ALTA_CHECKIN)
    if (demas.length) {
      return NextResponse.json(
        { error: `Desde el check-in no se pueden establecer estos campos: ${demas.join(', ')}.`, code: 'campo_no_permitido' },
        { status: 400 },
      )
    }
    const parsed = schema.safeParse(soloCamposPermitidos(crudo, CAMPOS_ALTA_CHECKIN))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    }

    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { data: evento } = await createAdminClient()
      .from('events').select('id, status').eq('id', eventId).maybeSingle()
    if (!evento) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })

    const d = parsed.data
    const { normalizeEmail, findMemberByCedulaOrEmail, createMember, getMemberForLookupById } = await import('@/lib/supabase/queries/members')
    const { normalizePhoneOrNull } = await import('@/lib/phone')
    const { isDocumentType, isValidDocument, documentFormatMessage } = await import('@/lib/cedula')

    const documentType = d.document_type && isDocumentType(d.document_type) ? d.document_type : 'cedula'
    if (d.document_type && !isDocumentType(d.document_type)) {
      return NextResponse.json({ error: 'Tipo de documento inválido.', code: 'documento_invalido' }, { status: 400 })
    }
    // INT-1: el número se guarda en mayúsculas — dedup consistente para DNI y
    // pasaportes con letras.
    const cedula = (d.cedula ?? '').trim().toUpperCase() || null
    if (cedula && !isValidDocument(documentType, cedula)) {
      return NextResponse.json({ error: documentFormatMessage(documentType), code: 'documento_invalido' }, { status: 400 })
    }
    const email = d.email ? normalizeEmail(d.email) : null

    // En la fila lo MÁS común es que la persona sí exista y no se la haya
    // encontrado. Por eso el 409 devuelve a quién pertenece: la pantalla ofrece
    // hacerle el check-in a esa ficha en vez de crear un duplicado.
    if (cedula || email) {
      const existente = await findMemberByCedulaOrEmail(cedula, email, undefined, documentType)
      if (existente) {
        // findMemberByCedulaOrEmail solo devuelve el id; el nombre hace falta
        // para que la pantalla pueda decir A QUIÉN pertenece y ofrecer su ficha.
        const ficha = await getMemberForLookupById(existente.id)
        const nombre = ficha ? `${ficha.first_name} ${ficha.last_name}`.trim() : null
        return NextResponse.json({
          error: nombre
            ? `Ese documento o correo ya es de ${nombre}.`
            : 'Ya existe una persona con ese documento o correo.',
          code: 'duplicate',
          member: ficha
            ? { id: ficha.id, first_name: ficha.first_name, last_name: ficha.last_name }
            : { id: existente.id },
        }, { status: 409 })
      }
    }

    const member = await createMember({
      first_name: d.first_name,
      last_name: d.last_name,
      cedula,
      document_type: documentType,
      email,
      phone: normalizePhoneOrNull(d.phone ?? null),
      birth_date: d.birth_date || null,
    } as Parameters<typeof createMember>[0])

    // Cuenta de acceso: mismo trato que el alta normal, sin bloquear si falla.
    let invite: { sent: boolean; reason?: string } = { sent: false }
    if (email) {
      try {
        const { sendPasswordLink } = await import('@/lib/auth/password-link')
        invite = await sendPasswordLink({ email, tieneCuenta: false, nombre: d.first_name })
      } catch (e) {
        invite = { sent: false, reason: e instanceof Error ? e.message : 'error' }
      }
    }

    return NextResponse.json({ ...member, invite }, { status: 201 })
  } catch (error) {
    console.error('POST /api/events/[id]/members:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
