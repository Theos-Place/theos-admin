import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getMemberFamily } from '@/lib/supabase/queries/members'

// GET: otros integrantes de la familia del miembro (para check-in en familia).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
  const auth = await requireRoles()
  if (auth.res) return auth.res
    const { id } = await params
    return NextResponse.json(await getMemberFamily(id))
  } catch (error) {
    console.error('GET /api/members/[id]/family:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
