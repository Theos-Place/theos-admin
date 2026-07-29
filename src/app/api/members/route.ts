import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView, requireRoles } from '@/lib/auth/guard'
import { moduleScope } from '@/lib/auth/roles'
import { getMembers } from '@/lib/supabase/queries/members'
import { parseGroupsParam, parseOpsParam } from '@/lib/filter-units'

export async function GET(req: NextRequest) {
  try {
    // Padrón completo: solo roles con módulo miembros más allá de 'own'.
    const auth = await requireModuleView('miembros', { beyondOwn: true })
    // SEC-1: el PADRÓN completo exige alcance 'all' — lider_comite (scope
    // 'committee') pasaba el beyondOwn y podía listar/exportar todo; a su
    // gente la ve por /servidores (detalle del comité).
    if (auth.ctx && moduleScope(auth.ctx.roles, 'miembros') !== 'all') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    if (auth.res) return auth.res
    const { searchParams } = req.nextUrl
    const search    = searchParams.get('search')   ?? undefined
    const is_active = searchParams.get('is_active')
    const is_donor  = searchParams.get('is_donor')
    const is_server = searchParams.get('is_server')
    const active_attendance = searchParams.get('active_attendance')
    const rawPage     = Number(searchParams.get('page') ?? 1)
    const rawPageSize = Number(searchParams.get('pageSize') ?? 50)
    const page     = Number.isFinite(rawPage)     ? Math.max(1, Math.trunc(rawPage)) : 1
    const pageSize = Number.isFinite(rawPageSize) ? Math.min(200, Math.max(1, Math.trunc(rawPageSize))) : 50

    // Filtros avanzados serializados como JSON (validados como array).
    let conditions
    const rawConditions = searchParams.get('conditions')
    if (rawConditions) {
      try {
        const parsed = JSON.parse(rawConditions)
        if (Array.isArray(parsed)) conditions = parsed
      } catch { /* condiciones malformadas → se ignoran */ }
    }

    const result = await getMembers({
      search,
      conditions,
      groups: parseGroupsParam(searchParams.get('groups')),
      topLevelOps: parseOpsParam(searchParams.get('ops')),
      is_active: is_active !== null ? is_active === 'true' : true,
      is_donor:  is_donor  !== null ? is_donor  === 'true' : undefined,
      is_server: is_server === 'true' ? true : undefined,
      active_attendance: active_attendance === 'true' ? true : undefined,
      page,
      pageSize,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/members:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRoles('editor_perfiles', 'direccion', 'encargado_staff', 'coordinador_estudios')
    if (auth.res) return auth.res
    const body = await req.json()
    const sendInvite = Boolean(body?.send_invite)

    const { MEMBER_WRITE_FIELDS, normalizeEmail } = await import('@/lib/supabase/queries/members')
    const payload: Record<string, unknown> = {}
    for (const k of MEMBER_WRITE_FIELDS) if (k in body) payload[k] = body[k]

    // Teléfonos solo dígitos (centralizado): cubre formularios, check-in familia e imports.
    const { normalizePhoneOrNull } = await import('@/lib/phone')
    if ('phone' in payload) payload.phone = normalizePhoneOrNull(payload.phone as string)
    if ('emergency_contact_phone' in payload) payload.emergency_contact_phone = normalizePhoneOrNull(payload.emergency_contact_phone as string)
    // Correo normalizado (trim + minúsculas) ANTES de guardar: lo que se
    // compara en el chequeo de duplicados es lo mismo que queda en la BD.
    if ('email' in payload) payload.email = normalizeEmail(payload.email)
    // INT-1: el número se guarda en MAYÚSCULAS (dedup consistente para DNI/
    // pasaporte con letras; las cédulas CR son dígitos y no cambian).
    if ('cedula' in payload && typeof payload.cedula === 'string') payload.cedula = payload.cedula.trim().toUpperCase() || null
    const documentType = typeof payload.document_type === 'string' && payload.document_type ? payload.document_type : 'cedula'
    const { isDocumentType, isValidDocument, documentFormatMessage } = await import('@/lib/cedula')
    if (!isDocumentType(documentType)) {
      return NextResponse.json({ error: 'Tipo de documento inválido.', code: 'documento_invalido' }, { status: 400 })
    }
    if (typeof payload.cedula === 'string' && payload.cedula && !isValidDocument(documentType, payload.cedula)) {
      return NextResponse.json({ error: documentFormatMessage(documentType), code: 'documento_invalido' }, { status: 400 })
    }

    // Verificación de duplicados a nivel de app (documento / correo), porque la
    // BD no tiene el UNIQUE activo sobre estos campos. El documento dedupea por
    // PAREJA (tipo, número normalizado) — INT-1.
    const cedula = typeof payload.cedula === 'string' ? payload.cedula : ''
    const email = typeof payload.email === 'string' ? payload.email : ''
    if (cedula || email) {
      const { findMemberByCedulaOrEmail } = await import('@/lib/supabase/queries/members')
      const existing = await findMemberByCedulaOrEmail(cedula || null, email || null, undefined, documentType)
      if (existing) {
        return NextResponse.json(
          { error: 'Ya existe un miembro con ese documento o correo.', code: 'duplicate' },
          { status: 409 },
        )
      }
    }

    const { createMember } = await import('@/lib/supabase/queries/members')
    const member = await createMember(payload as Parameters<typeof createMember>[0])

    // Invitación a completar perfil (best-effort): crea usuario de Auth y envía
    // el link para setear contraseña. No bloquea la creación si falla (p. ej. sin SMTP).
    let invite: { sent: boolean; reason?: string } = { sent: false }
    if (sendInvite && member.email) {
      const { inviteMemberToCompleteProfile } = await import('@/lib/auth/invite')
      invite = await inviteMemberToCompleteProfile(member.id, member.email)
    }

    return NextResponse.json({ ...member, invite }, { status: 201 })
  } catch (error) {
    console.error('POST /api/members:', error)
    const e = error as { code?: string; message?: string }
    if (e?.code === '23505') {
      return NextResponse.json(
        { error: 'Ya existe un miembro con ese documento o correo.', code: 'duplicate' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}