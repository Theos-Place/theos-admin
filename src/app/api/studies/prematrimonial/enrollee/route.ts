import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { meetsPrematRequirement } from '@/lib/supabase/queries/prematrimonial'

// GET: datos mínimos del miembro que se va a inscribir al prematrimonial cuando
// un admin lo hace EN NOMBRE DE otro (flujo "Ver disponibilidad como"). Solo
// admin/direccion — son quienes pueden actuar por otro miembro. Devuelve lo
// justo para armar el paso 1 del wizard (nombre, correo, cédula y si cumple el
// requisito PRE-5); ninguna otra información sensible.
export async function GET(req: NextRequest) {
  const auth = await requireRoles('admin', 'direccion')
  if (auth.res) return auth.res
  const memberId = req.nextUrl.searchParams.get('member_id')?.trim()
  if (!memberId) {
    return NextResponse.json({ error: 'Falta el miembro.' }, { status: 400 })
  }
  try {
    const admin = createAdminClient()
    const { data: member } = await admin
      .from('members')
      .select('id, first_name, last_name, email, cedula')
      .eq('id', memberId)
      .maybeSingle()
    if (!member) {
      return NextResponse.json({ error: 'No se encontró el miembro.' }, { status: 404 })
    }
    const m = member as { id: string; first_name: string | null; last_name: string | null; email: string | null; cedula: string | null }
    const meets_requirement = await meetsPrematRequirement(m.id)
    return NextResponse.json({
      member_id: m.id,
      name: `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim(),
      email: m.email,
      has_cedula: !!(m.cedula && String(m.cedula).trim()),
      meets_requirement,
    })
  } catch (error) {
    console.error('GET prematrimonial/enrollee:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
