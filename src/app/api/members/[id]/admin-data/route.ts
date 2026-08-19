import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { isUuid } from '@/lib/validate'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/types/database'

// Datos administrativos del miembro. SOLO roles administrativos (el miembro
// NUNCA accede, ni lectura). La escritura de not_recommended_to_lead_studies
// se restringe además a coordinador_estudios y admin; la de
// authorized_virtual_studies a coordinador_estudios, coordinador_dirigentes y
// admin (no direccion, no el propio miembro).

function isStudyAdmin(roles: string[]): boolean {
  return roles.some(r => (STUDY_ADMIN_ROLES as string[]).includes(r))
}

function canEditVirtualAuth(roles: string[]): boolean {
  return roles.includes('admin') || roles.includes('coordinador_estudios') || roles.includes('coordinador_dirigentes')
}

/** Onboarding de servidores: SOLO admin y los encargados de servidores
 *  (decisión 2026-08-19: ni dirección ni los roles de estudios lo ven). */
function canEditOnboarding(roles: string[]): boolean {
  return roles.includes('admin') || roles.includes('encargado_staff') || roles.includes('coordinador_servidores')
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  const viewStudies = isStudyAdmin(auth.ctx.roles)
  const viewOnboarding = canEditOnboarding(auth.ctx.roles)
  if (!viewStudies && !viewOnboarding) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('member_admin_data')
      .select(`
        not_recommended_to_lead_studies, not_recommended_to_lead_studies_at, not_recommended_reason,
        marker:members!member_admin_data_not_recommended_to_lead_studies_by_fkey(first_name, last_name),
        authorized_virtual_studies, authorized_virtual_studies_at,
        virtual_approver:members!member_admin_data_authorized_virtual_studies_by_fkey(first_name, last_name),
        servers_onboarding, servers_onboarding_at,
        onboarding_marker:members!member_admin_data_servers_onboarding_by_fkey(first_name, last_name)
      `)
      .eq('member_id', id)
      .maybeSingle()
    if (error) throw error
    const row = data as {
      not_recommended_to_lead_studies: boolean
      not_recommended_to_lead_studies_at: string | null
      not_recommended_reason: string | null
      marker: { first_name: string | null; last_name: string | null } | null
      authorized_virtual_studies: boolean
      authorized_virtual_studies_at: string | null
      virtual_approver: { first_name: string | null; last_name: string | null } | null
      servers_onboarding: boolean
      servers_onboarding_at: string | null
      onboarding_marker: { first_name: string | null; last_name: string | null } | null
    } | null
    const canApprove = auth.ctx.roles.includes('admin') || auth.ctx.roles.includes('coordinador_estudios')
    // Cada bloque viaja solo a quien le corresponde: los encargados de
    // servidores no reciben los datos de estudios, ni al revés.
    return NextResponse.json({
      can_view_studies: viewStudies,
      not_recommended_to_lead_studies: viewStudies ? (row?.not_recommended_to_lead_studies ?? false) : false,
      marked_at: viewStudies ? (row?.not_recommended_to_lead_studies_at ?? null) : null,
      not_recommended_reason: viewStudies ? (row?.not_recommended_reason ?? null) : null,
      marked_by_name: viewStudies && row?.marker
        ? [row.marker.first_name, row.marker.last_name].filter(Boolean).join(' ') || null
        : null,
      can_edit: viewStudies && canApprove, // el resto de roles de estudios lo ve read-only
      authorized_virtual_studies: viewStudies ? (row?.authorized_virtual_studies ?? false) : false,
      authorized_virtual_studies_at: viewStudies ? (row?.authorized_virtual_studies_at ?? null) : null,
      authorized_virtual_studies_by_name: viewStudies && row?.virtual_approver
        ? [row.virtual_approver.first_name, row.virtual_approver.last_name].filter(Boolean).join(' ') || null
        : null,
      can_edit_virtual: viewStudies && canEditVirtualAuth(auth.ctx.roles),
      servers_onboarding: viewOnboarding ? (row?.servers_onboarding ?? false) : false,
      servers_onboarding_at: viewOnboarding ? (row?.servers_onboarding_at ?? null) : null,
      servers_onboarding_by_name: viewOnboarding && row?.onboarding_marker
        ? [row.onboarding_marker.first_name, row.onboarding_marker.last_name].filter(Boolean).join(' ') || null
        : null,
      can_edit_onboarding: viewOnboarding,
    })
  } catch (error) {
    console.error('GET /api/members/[id]/admin-data:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
  try {
    const body = (await req.json().catch(() => ({}))) as {
      not_recommended_to_lead_studies?: boolean
      reason?: string
      authorized_virtual_studies?: boolean
      servers_onboarding?: boolean
    }
    const hasApproval = 'not_recommended_to_lead_studies' in body
    const hasVirtual = 'authorized_virtual_studies' in body
    const hasOnboarding = 'servers_onboarding' in body
    if (!hasApproval && !hasVirtual && !hasOnboarding) {
      return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
    }
    // Marcar como no recomendado para dar estudios: solo coordinador_estudios y admin.
    if (hasApproval) {
      const canApprove = auth.ctx.roles.includes('admin') || auth.ctx.roles.includes('coordinador_estudios')
      if (!canApprove) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      if (typeof body.not_recommended_to_lead_studies !== 'boolean') {
        return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
      }
      // Marcar exige justificación (quedan registradas razón, fecha y quién).
      if (body.not_recommended_to_lead_studies && !(typeof body.reason === 'string' && body.reason.trim())) {
        return NextResponse.json({ error: 'Indicá la razón para marcar a esta persona' }, { status: 400 })
      }
    }
    // Autorizar estudios virtuales: coordinador_estudios, coordinador_dirigentes y admin.
    if (hasVirtual) {
      if (!canEditVirtualAuth(auth.ctx.roles)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      if (typeof body.authorized_virtual_studies !== 'boolean') {
        return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
      }
    }
    // Onboarding de servidores: roles que administran servidores.
    if (hasOnboarding) {
      if (!canEditOnboarding(auth.ctx.roles)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      if (typeof body.servers_onboarding !== 'boolean') {
        return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
      }
    }
    const supabase = createAdminClient()
    const now = new Date().toISOString()
    const update: Database['public']['Tables']['member_admin_data']['Insert'] = { member_id: id, updated_at: now }
    if (hasApproval) {
      update.not_recommended_to_lead_studies = body.not_recommended_to_lead_studies
      update.not_recommended_to_lead_studies_by = auth.ctx.memberId
      update.not_recommended_to_lead_studies_at = now
      // La razón viaja al marcar; al desmarcar se limpia.
      update.not_recommended_reason = body.not_recommended_to_lead_studies ? body.reason!.trim() : null
    }
    if (hasVirtual) {
      update.authorized_virtual_studies = body.authorized_virtual_studies
      update.authorized_virtual_studies_by = auth.ctx.memberId
      update.authorized_virtual_studies_at = now
    }
    if (hasOnboarding) {
      update.servers_onboarding = body.servers_onboarding
      // La fecha se sella sola al marcar; al desmarcar se limpia (junto con quién).
      update.servers_onboarding_by = body.servers_onboarding ? auth.ctx.memberId : null
      update.servers_onboarding_at = body.servers_onboarding ? now : null
    }
    const { error } = await supabase.from('member_admin_data').upsert(update, { onConflict: 'member_id' })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/members/[id]/admin-data:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
