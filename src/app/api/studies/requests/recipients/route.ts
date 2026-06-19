import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import {
  getNotificationRecipients, addNotificationRecipient, removeNotificationRecipient,
  getEligibleCoordinators,
} from '@/lib/supabase/queries/study-requests'

// Gestión de destinatarios: admin y coordinador de estudios (igual que la RLS).

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRoles('direccion', 'coordinador_estudios')
    if (auth.res) return auth.res
    if (req.nextUrl.searchParams.get('eligible') === '1') {
      return NextResponse.json(await getEligibleCoordinators())
    }
    return NextResponse.json(await getNotificationRecipients())
  } catch (error) {
    console.error('GET /api/studies/requests/recipients:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRoles('direccion', 'coordinador_estudios')
    if (auth.res) return auth.res
    const body = await req.json()
    if (!body?.member_id) return NextResponse.json({ error: 'Se requiere member_id' }, { status: 400 })
    await addNotificationRecipient(body.member_id)
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('POST /api/studies/requests/recipients:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireRoles('direccion', 'coordinador_estudios')
    if (auth.res) return auth.res
    const memberId = req.nextUrl.searchParams.get('member_id')
    if (!memberId) return NextResponse.json({ error: 'Se requiere member_id' }, { status: 400 })
    await removeNotificationRecipient(memberId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/studies/requests/recipients:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
