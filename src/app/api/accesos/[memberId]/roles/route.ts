import { NextRequest, NextResponse } from 'next/server'
import { assignMemberRole, revokeMemberRole } from '@/lib/supabase/queries/members'

// POST: asigna un rol al miembro. Body: { role }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  try {
    const { memberId } = await params
    const { role } = await req.json()
    await assignMemberRole(memberId, role)
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('POST /api/accesos/[memberId]/roles:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}

// DELETE: revoca un rol del miembro. Body: { role }
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  try {
    const { memberId } = await params
    const { role } = await req.json()
    await revokeMemberRole(memberId, role)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/accesos/[memberId]/roles:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
