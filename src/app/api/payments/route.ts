import { NextRequest, NextResponse } from 'next/server'
import { notifyEnrollment } from '@/lib/email/enrollment-notify'
import { requireModuleView } from '@/lib/auth/guard'
import { rateLimit } from '@/lib/rate-limit'
import { isUuid } from '@/lib/validate'
import { createAdminClient } from '@/lib/supabase/admin'
import { submitEnrollmentComprobante, PAYMENT_RECEIPTS_BUCKET } from '@/lib/supabase/queries/payments'

// POST (multipart): sube el comprobante (screenshot) al bucket privado y adjunta el
// pago de la matrícula (actualiza el pago pendiente auto-creado o crea uno).
// Campos: file, enrollment_id, reference. Monto resuelto server-side (costo del plan).
export async function POST(req: NextRequest) {
  const auth = await requireModuleView('estudios') // matrícula = estudios; staff que registra
  if (auth.res) return auth.res
  // Archivos de hasta 8MB: sin tope un usuario autenticado podía llenar el bucket.
  if (!rateLimit(`comprobante:${auth.ctx.userId}`, 3, 60_000)) {
    return NextResponse.json({ error: 'Demasiados comprobantes seguidos; esperá un minuto.' }, { status: 429 })
  }
  try {
    const form = await req.formData()
    const file = form.get('file')
    const enrollmentId = String(form.get('enrollment_id') ?? '')
    const reference = (String(form.get('reference') ?? '')).trim() || null

    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Falta el comprobante.' }, { status: 400 })
    // isUuid también evita segmentos de path arbitrarios en el bucket.
    if (!enrollmentId || !isUuid(enrollmentId)) return NextResponse.json({ error: 'Falta la matrícula.' }, { status: 400 })
    if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'El archivo supera 8 MB.' }, { status: 400 })

    const supabase = createAdminClient()

    // Subir comprobante al bucket PRIVADO (service role).
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `${enrollmentId}/${crypto.randomUUID()}.${ext}`
    const bytes = new Uint8Array(await file.arrayBuffer())
    const { error: upErr } = await supabase.storage
      .from(PAYMENT_RECEIPTS_BUCKET)
      .upload(path, bytes, { contentType: file.type || 'application/octet-stream', upsert: false })
    if (upErr) {
      console.error('upload receipt:', upErr.message)
      return NextResponse.json({ error: 'No se pudo subir el comprobante.' }, { status: 500 })
    }

    const result = await submitEnrollmentComprobante({ enrollment_id: enrollmentId, receipt_path: path, reference_code: reference })
    if (!result) return NextResponse.json({ error: 'No se encontró la matrícula.' }, { status: 404 })

    // El correo de bienvenida sale ACÁ, no al matricularse.
    //
    // Antes salía apenas se creaba la matrícula, o sea ANTES de que la persona
    // pagara. Le decía "tu matrícula fue confirmada" a alguien que todavía
    // estaba viendo la pantalla del comprobante — y si abandonaba ahí, quedaba
    // con un correo de bienvenida a un curso que nunca llevó. Es lo que pasó
    // con Alexandra Forero.
    //
    // Los estudios SIN costo siguen avisando al matricularse: ahí no hay
    // comprobante que esperar y este código nunca corre.
    if (result.group_id) {
      await notifyEnrollment(result.group_id, result.member_id)
    }
    return NextResponse.json({ ok: true, id: result.id }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'COMPROBANTE_EN_REVISION') {
      return NextResponse.json(
        { error: 'Ya hay un comprobante en revisión para esta matrícula. Esperá el resultado antes de subir otro.' },
        { status: 409 },
      )
    }
    console.error('POST /api/payments:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
