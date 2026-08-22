import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { rateLimit } from '@/lib/rate-limit'
import { isUuid } from '@/lib/validate'
import { createAdminClient } from '@/lib/supabase/admin'
import { submitEventComprobante, PAYMENT_RECEIPTS_BUCKET } from '@/lib/supabase/queries/payments'
import { EVENT_ON_BEHALF_ROLES } from '@/lib/auth/on-behalf'

// Mismos roles que gestionan event_registrations desde el panel de staff.

// POST (multipart): sube el comprobante de una inscripción a evento. Dueño de
// la inscripción o staff (mismo patrón anti-suplantación que /api/payments).
// Campos: file, reference. Monto resuelto server-side (registrationPricing).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles() // solo sesión; autorización fina abajo (dueño o staff)
  if (auth.res) return auth.res
  if (!rateLimit(`comprobante-evento:${auth.ctx.userId}`, 3, 60_000)) {
    return NextResponse.json({ error: 'Demasiados comprobantes seguidos; esperá un minuto.' }, { status: 429 })
  }
  try {
    const { id: registrationId } = await params
    if (!isUuid(registrationId)) return NextResponse.json({ error: 'Id inválido.' }, { status: 400 })

    const supabase = createAdminClient()
    const { data: reg } = await supabase
      .from('event_registrations').select('member_id').eq('id', registrationId).maybeSingle()
    if (!reg) return NextResponse.json({ error: 'Inscripción no encontrada.' }, { status: 404 })

    const isOwner = auth.ctx.memberId === (reg as { member_id: string }).member_id
    const isStaff = auth.ctx.roles.includes('admin')
      || EVENT_ON_BEHALF_ROLES.some(r => auth.ctx.roles.includes(r))
    if (!isOwner && !isStaff) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const form = await req.formData()
    const file = form.get('file')
    const reference = (String(form.get('reference') ?? '')).trim() || null

    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Falta el comprobante.' }, { status: 400 })
    if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'El archivo supera 8 MB.' }, { status: 400 })

    // Prefijo distinto al de matrícula ({enrollment_id}/…) para no chocar de path.
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `event-registrations/${registrationId}/${crypto.randomUUID()}.${ext}`
    const bytes = new Uint8Array(await file.arrayBuffer())
    const { error: upErr } = await supabase.storage
      .from(PAYMENT_RECEIPTS_BUCKET)
      .upload(path, bytes, { contentType: file.type || 'application/octet-stream', upsert: false })
    if (upErr) {
      console.error('upload receipt evento:', upErr.message)
      return NextResponse.json({ error: 'No se pudo subir el comprobante.' }, { status: 500 })
    }

    const result = await submitEventComprobante({ event_registration_id: registrationId, receipt_path: path, reference_code: reference })
    if (!result) return NextResponse.json({ error: 'No se encontró la inscripción.' }, { status: 404 })
    return NextResponse.json({ ok: true, id: result.id }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'COMPROBANTE_EN_REVISION') {
      return NextResponse.json(
        { error: 'Ya hay un comprobante en revisión para esta inscripción. Esperá el resultado antes de subir otro.' },
        { status: 409 },
      )
    }
    console.error('POST /api/event-registrations/[id]/comprobante:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
