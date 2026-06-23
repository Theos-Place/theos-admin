import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { isUuid } from '@/lib/validate'
import { createAdminClient } from '@/lib/supabase/admin'

// Datos espirituales del miembro. Acceso: el propio miembro a SU fila, o roles
// administrativos a cualquiera. El service role salta RLS; el guard la replica.

function isStudyAdmin(roles: string[]): boolean {
  return roles.some(r => (STUDY_ADMIN_ROLES as string[]).includes(r))
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
  if (auth.ctx.memberId !== id && !isStudyAdmin(auth.ctx.roles)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('member_spiritual_data')
      .select('baptism_date, baptism_place, spiritual_gifts')
      .eq('member_id', id)
      .maybeSingle()
    if (error) throw error
    return NextResponse.json(data ?? { baptism_date: null, baptism_place: null, spiritual_gifts: null })
  } catch (error) {
    console.error('GET /api/members/[id]/spiritual:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
  if (auth.ctx.memberId !== id && !isStudyAdmin(auth.ctx.roles)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  try {
    const body = (await req.json().catch(() => ({}))) as {
      baptism_date?: string | null; baptism_place?: string | null; spiritual_gifts?: string | null
    }
    const supabase = createAdminClient()
    const { error } = await supabase.from('member_spiritual_data').upsert({
      member_id: id,
      baptism_date: body.baptism_date || null,
      baptism_place: body.baptism_place?.trim() || null,
      spiritual_gifts: body.spiritual_gifts?.trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'member_id' })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/members/[id]/spiritual:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
