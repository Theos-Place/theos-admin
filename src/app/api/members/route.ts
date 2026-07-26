import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView, requireRoles } from '@/lib/auth/guard'
import { getMembers } from '@/lib/supabase/queries/members'
import { parseGroupsParam, parseOpsParam } from '@/lib/filter-units'

export async function GET(req: NextRequest) {
  try {
    // Padrón completo: solo roles con módulo miembros más allá de 'own'.
    const auth = await requireModuleView('miembros', { beyondOwn: true })
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
    if ('cedula' in payload && typeof payload.cedula === 'string') payload.cedula = payload.cedula.trim() || null

    // Verificación de duplicados a nivel de app (cédula / correo), porque la BD
    // no tiene el UNIQUE activo sobre estos campos.
    const cedula = typeof payload.cedula === 'string' ? payload.cedula : ''
    const email = typeof payload.email === 'string' ? payload.email : ''
    if (cedula || email) {
      const { findMemberByCedulaOrEmail } = await import('@/lib/supabase/queries/members')
      const existing = await findMemberByCedulaOrEmail(cedula || null, email || null)
      if (existing) {
        return NextResponse.json(
          { error: 'Ya existe un miembro con esa cédula o correo.', code: 'duplicate' },
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
        { error: 'Ya existe un miembro con esa cédula o correo.', code: 'duplicate' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}