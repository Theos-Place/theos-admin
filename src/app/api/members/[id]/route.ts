import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getMemberFullById, updateMember } from '@/lib/supabase/queries/members'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const { id } = await params
    const member = await getMemberFullById(id)
    if (!member) {
      return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    }
    // Las donaciones/pagos del perfil son datos financieros: solo finanzas,
    // dirección y admin los ven (auditoría S3). El resto recibe la lista vacía
    // (la UI ya oculta el tab con hasFinanceRole; esto lo hace cumplir el server).
    const canSeeFinance = auth.ctx.roles.some(r => ['admin', 'finanzas', 'direccion'].includes(r))
    return NextResponse.json(canSeeFinance ? member : { ...member, donations: [] })
  } catch (error) {
    console.error('GET /api/members/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('editor_perfiles', 'direccion', 'encargado_staff', 'coordinador_estudios')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    const updates = await req.json()
    const member = await updateMember(id, updates)
    return NextResponse.json(member)
  } catch (error) {
    console.error('PUT /api/members/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
