import { NextRequest, NextResponse } from 'next/server'
import { canViewMemberProfile, requireModuleView, requireRoles } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validate'
import { getMemberFullById, updateMember } from '@/lib/supabase/queries/members'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    // Sin permiso de padrón (módulo miembros más allá de 'own'), solo se
    // permite el propio perfil o el de un integrante de la familia.
    if (!(await canViewMemberProfile(auth.ctx, id))) {
      const mod = await requireModuleView('miembros', { beyondOwn: true })
      if (mod.res) return mod.res
    }
    const member = await getMemberFullById(id)
    if (!member) {
      return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    }
    // Donaciones del perfil (decisión 2026-06-11): MONTOS solo para rol
    // finanzas; admin/dirección ven las filas con amount null; el resto no
    // recibe las filas.
    if (auth.ctx.roles.includes('finanzas')) return NextResponse.json(member)
    const seesRows = auth.ctx.roles.some(r => ['admin', 'direccion'].includes(r))
    return NextResponse.json({
      ...member,
      donations: seesRows ? member.donations.map(d => ({ ...d, amount: null })) : [],
    })
  } catch (error) {
    console.error('GET /api/members/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Update PARCIAL de la ficha (allowlist con `k in body`). Se expone como PUT y
// como PATCH: la convención del repo es PATCH para updates parciales, y varios
// clientes ya lo llamaban así (el guardado de documento del prematrimonial
// pegaba a PATCH y recibía 405 — la ruta solo exportaba PUT).
async function handleUpdate(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    // Autenticado. STAFF de padrón edita cualquier ficha; un miembro sin ese rol
    // solo puede editar SU PROPIA ficha (self-service para completar su cédula).
    const auth = await requireRoles()
    if (auth.res) return auth.res
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })

    const STAFF_ROLES = ['editor_perfiles', 'direccion', 'encargado_staff', 'coordinador_estudios']
    const isStaff = auth.ctx.roles.some(r => STAFF_ROLES.includes(r))
    const isAdmin = auth.ctx.roles.includes('admin')
    const isSelf = !!auth.ctx.memberId && auth.ctx.memberId === id
    if (!isStaff && !isAdmin && !isSelf) {
      return NextResponse.json({ error: 'No podés editar este perfil.' }, { status: 403 })
    }

    const body = await req.json()

    // Mismo tratamiento que el alta: allowlist de columnas, teléfonos solo
    // dígitos, correo normalizado y chequeo de duplicados (la BD no tiene
    // UNIQUE en cédula/correo — sin esto, editar crea los duplicados que el
    // alta previene con 409).
    const { MEMBER_WRITE_FIELDS, normalizeEmail, findMemberByCedulaOrEmail } = await import('@/lib/supabase/queries/members')
    // El miembro editando su propia ficha solo toca datos personales (no flags
    // de gestión como is_donor/is_active, reservados a staff).
    const SELF_ONLY_EXCLUDE = new Set(['is_donor', 'is_active'])
    const allowedFields = (isStaff || isAdmin)
      ? MEMBER_WRITE_FIELDS
      : MEMBER_WRITE_FIELDS.filter(f => !SELF_ONLY_EXCLUDE.has(f))
    const updates: Record<string, unknown> = {}
    for (const k of allowedFields) if (k in body) updates[k] = body[k]
    // Toggle "perfil de sistema": solo admin puede marcarlo.
    if (isAdmin && 'is_system' in body) updates.is_system = !!body.is_system
    const { normalizePhoneOrNull } = await import('@/lib/phone')
    if ('phone' in updates) updates.phone = normalizePhoneOrNull(updates.phone as string)
    if ('emergency_contact_phone' in updates) updates.emergency_contact_phone = normalizePhoneOrNull(updates.emergency_contact_phone as string)
    if ('email' in updates) updates.email = normalizeEmail(updates.email)
    // INT-1: número en MAYÚSCULAS (dedup consistente para documentos con letras).
    if ('cedula' in updates && typeof updates.cedula === 'string') updates.cedula = updates.cedula.trim().toUpperCase() || null

    // INT-1: validación por TIPO de documento (server-side). Si el patch no
    // trae el tipo, se usa el actual del miembro (default 'cedula').
    const { isDocumentType, isValidDocument, documentFormatMessage } = await import('@/lib/cedula')
    let documentType = typeof updates.document_type === 'string' ? updates.document_type : ''
    if (documentType && !isDocumentType(documentType)) {
      return NextResponse.json({ error: 'Tipo de documento inválido.', code: 'documento_invalido' }, { status: 400 })
    }
    if (!documentType) {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const { data: cur } = await createAdminClient()
        .from('members').select('document_type').eq('id', id).maybeSingle()
      documentType = (cur as { document_type?: string } | null)?.document_type ?? 'cedula'
    }
    if (typeof updates.cedula === 'string' && updates.cedula && isDocumentType(documentType) && !isValidDocument(documentType, updates.cedula)) {
      return NextResponse.json({ error: documentFormatMessage(documentType), code: 'cedula_invalida' }, { status: 400 })
    }

    const cedula = typeof updates.cedula === 'string' ? updates.cedula : ''
    const email = typeof updates.email === 'string' ? updates.email : ''
    if (cedula || email) {
      const existing = await findMemberByCedulaOrEmail(cedula || null, email || null, id, documentType)
      if (existing) {
        return NextResponse.json(
          { error: 'Ya existe otro miembro con ese documento o correo.', code: 'duplicate' },
          { status: 409 },
        )
      }
    }

    const member = await updateMember(id, updates)
    return NextResponse.json(member)
  } catch (error) {
    // 23505 = índice único parcial de cédula (migración 114): cierra el TOCTOU
    // que el chequeo de arriba no cubre entre requests concurrentes.
    if ((error as { code?: string })?.code === '23505') {
      return NextResponse.json(
        { error: 'Ya existe otro miembro con esa cédula o correo.', code: 'duplicate' },
        { status: 409 },
      )
    }
    console.error('PUT/PATCH /api/members/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export const PUT = handleUpdate
export const PATCH = handleUpdate
