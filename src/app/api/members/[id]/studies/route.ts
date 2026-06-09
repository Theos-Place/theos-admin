import { NextRequest, NextResponse } from 'next/server'
import { addMemberStudy, getPlanIdByCode } from '@/lib/supabase/queries/studies'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = (await req.json()) as { plan_code?: string; date?: string | null; status?: string }
    if (!body.plan_code) return NextResponse.json({ error: 'Falta plan_code' }, { status: 400 })

    const planId = await getPlanIdByCode(body.plan_code)
    if (!planId) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })

    await addMemberStudy({
      member_id: id,
      plan_id: planId,
      completed_at: body.date ? `${body.date}T12:00:00+00` : null,
      status: body.status ?? 'completed',
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/members/[id]/studies:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
