import { NextRequest, NextResponse } from 'next/server'
import { enrollMember, withdrawMember, setEnrollmentGrade } from '@/lib/supabase/queries/studies'

// POST: inscribe un miembro. Body: { member_id }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { member_id } = await req.json()
    await enrollMember(id, member_id)
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('POST enrollments:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PATCH: actualiza nota. Body: { member_id, grade }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { member_id, grade } = await req.json()
    await setEnrollmentGrade(id, member_id, Number(grade))
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PATCH enrollments:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE: retira un miembro. Body: { member_id, reason? }
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { member_id, reason } = await req.json()
    await withdrawMember(id, member_id, reason)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE enrollments:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
