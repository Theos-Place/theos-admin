import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { RoleId } from '@/types/auth'

/**
 * Devuelve el usuario autenticado actual con sus roles activos.
 * Forma compatible con el hook de auth del cliente.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    // El member y los roles se leen con service role (RLS aún no está activo
    // en el data layer — ver Fase 3).
    const admin = createAdminClient()

    const { data: member } = await admin
      .from('members')
      .select('id, first_name, last_name, email, cedula, is_system')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!member) {
      // Usuario de auth sin member enlazado: sin acceso a módulos.
      return NextResponse.json({
        user: { name: user.email ?? '', email: user.email ?? '', roles: [], role: null, member_id: null, family_member_ids: [], has_cedula: true, is_system: false, in_study_committee: false, granted_form_ids: [], managed_event_ids: [] },
      })
    }

    const { data: roleRows } = await admin
      .from('member_roles')
      .select('role')
      .eq('member_id', member.id)
      .eq('is_active', true)

    // Ids de familia (mismo family_unit_id) — para que el cliente sepa qué
    // perfiles puede ver además del propio (espejo de canViewMemberProfile).
    const { data: ownUnits } = await admin
      .from('family_members').select('family_unit_id').eq('member_id', member.id)
    const unitIds = (ownUnits ?? []).map(r => (r as { family_unit_id: string }).family_unit_id)
    let familyMemberIds: string[] = []
    if (unitIds.length) {
      const { data: shared } = await admin
        .from('family_members').select('member_id').in('family_unit_id', unitIds)
      familyMemberIds = [...new Set(
        (shared ?? []).map(r => (r as { member_id: string }).member_id).filter(id => id !== member.id),
      )]
    }

    // Regla de negocio: todo usuario autenticado con member enlazado es 'miembro'
    // por defecto (solo ve su propio perfil) si no tiene otros roles activos.
    const explicitRoles = (roleRows ?? []).map(r => r.role as RoleId)
    const roles: RoleId[] = explicitRoles.length ? explicitRoles : ['miembro']
    // ¿Está en el comité de estudios bíblicos? Habilita /estudios/solicitudes
    // con alcance acotado (solo lo asignado) para gente SIN rol en el sistema.
    let inStudyCommittee = false
    try {
      const { isStudyCommitteeMember } = await import('@/lib/supabase/queries/study-requests')
      inStudyCommittee = await isStudyCommitteeMember(member.id)
    } catch (e) {
      // Best-effort: si falla, la persona simplemente no ve la pantalla.
      console.warn('auth/me: comité de estudios:', e instanceof Error ? e.message : e)
    }

    // Accesos puntuales a formularios (form_access_grants): habilitan
    // /formularios y la pantalla de respuestas de ESOS formularios a gente sin
    // el módulo. Mismo patrón que in_study_committee.
    let grantedFormIds: string[] = []
    try {
      const { getGrantedFormIds } = await import('@/lib/supabase/queries/forms')
      grantedFormIds = await getGrantedFormIds(member.id)
    } catch (e) {
      console.warn('auth/me: accesos a formularios:', e instanceof Error ? e.message : e)
    }

    // FRM-1 B: eventos que tiene a cargo. Habilitan /eventos y su detalle a
    // quien no tiene el módulo (mismo patrón que granted_form_ids).
    let managedEventIds: string[] = []
    try {
      const { getManagedEventIds } = await import('@/lib/supabase/queries/events')
      managedEventIds = await getManagedEventIds(member.id)
    } catch (e) {
      console.warn('auth/me: eventos a cargo:', e instanceof Error ? e.message : e)
    }

    // FIN-2: fecha del último descarte del aviso de documento. El aviso
    // reaparece a los 14 días (la regla vive en lib/members/document-prompt).
    let documentPromptDismissedAt: string | null = null
    try {
      const { DOCUMENT_PROMPT_NOTICE } = await import('@/lib/members/document-prompt')
      const { data: dis } = await admin
        .from('notice_dismissals')
        .select('dismissed_at')
        .eq('member_id', member.id)
        .eq('notice_key', DOCUMENT_PROMPT_NOTICE)
        .maybeSingle()
      documentPromptDismissedAt = (dis as { dismissed_at?: string } | null)?.dismissed_at ?? null
    } catch (e) {
      // Best-effort: si falla, el aviso simplemente se muestra.
      console.warn('auth/me: descarte del aviso de documento:', e instanceof Error ? e.message : e)
    }

    const name = `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim() || (member.email ?? '')

    return NextResponse.json({
      user: {
        name,
        email: member.email ?? user.email ?? '',
        roles,
        role: roles[0] ?? null,
        member_id: member.id,
        family_member_ids: familyMemberIds,
        // Recordatorio de cédula: has_cedula=false dispara el banner (salvo
        // perfiles de sistema, que nunca tienen cédula por diseño).
        has_cedula: !!(member.cedula && String(member.cedula).trim()),
        document_prompt_dismissed_at: documentPromptDismissedAt,
        is_system: !!member.is_system,
        in_study_committee: inStudyCommittee,
        granted_form_ids: grantedFormIds,
        managed_event_ids: managedEventIds,
      },
    })
  } catch (error) {
    console.error('GET /api/auth/me:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
