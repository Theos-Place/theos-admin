import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { isUuid } from '@/lib/validate'
import { createAdminClient } from '@/lib/supabase/admin'

// Datos administrativos del miembro. SOLO roles administrativos (el miembro
// NUNCA accede, ni lectura). La escritura de approved_to_lead_studies se
// restringe además a coordinador_estudios y admin.

function isStudyAdmin(roles: string[]): boolean {
  return roles.some(r => (STUDY_ADMIN_ROLES as string[]).includes(r))
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  if (!isStudyAdmin(auth.ctx.roles)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
  try {
    // Tablas nuevas (mig. 091) aún no están en los tipos generados de Supabase.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any
    const { data, error } = await supabase
      .from('member_admin_data')
      .select('approved_to_lead_studies, approved_to_lead_studies_at, approver:members!member_admin_data_approved_to_lead_studies_by_fkey(first_name, last_name)')
      .eq('member_id', id)
      .maybeSingle()
    if (error) throw error
    const row = data as {
      approved_to_lead_studies: boolean
      approved_to_lead_studies_at: string | null
      approver: { first_name: string | null; last_name: string | null } | null
    } | null
    const canApprove = auth.ctx.roles.includes('admin') || auth.ctx.roles.includes('coordinador_estudios')
    return NextResponse.json({
      approved_to_lead_studies: row?.approved_to_lead_studies ?? false,
      approved_at: row?.approved_to_lead_studies_at ?? null,
      approved_by_name: row?.approver
        ? [row.approver.first_name, row.approver.last_name].filter(Boolean).join(' ') || null
        : null,
      can_edit: canApprove, // el resto de roles administrativos lo ve read-only
    })
  } catch (error) {
    console.error('GET /api/members/[id]/admin-data:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  // Aprobar para dar estudios: solo coordinador_estudios y admin.
  const canApprove = auth.ctx.roles.includes('admin') || auth.ctx.roles.includes('coordinador_estudios')
  if (!canApprove) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
  try {
    const body = (await req.json().catch(() => ({}))) as { approved_to_lead_studies?: boolean }
    if (typeof body.approved_to_lead_studies !== 'boolean') {
      return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
    }
    // Tablas nuevas (mig. 091) aún no están en los tipos generados de Supabase.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any
    const { error } = await supabase.from('member_admin_data').upsert({
      member_id: id,
      approved_to_lead_studies: body.approved_to_lead_studies,
      approved_to_lead_studies_by: auth.ctx.memberId,
      approved_to_lead_studies_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'member_id' })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/members/[id]/admin-data:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
