import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { createComprobantePayment, PAYMENT_RECEIPTS_BUCKET } from '@/lib/supabase/queries/payments'

// POST (multipart): sube el comprobante (screenshot) al bucket privado y crea el
// pago en revisión. Campos: file, member_id, group_id, reference. Concepto: matricula.
// El monto se resuelve server-side desde el costo del plan (no se confía en el cliente).
export async function POST(req: NextRequest) {
  const auth = await requireModuleView('estudios') // matrícula = estudios; staff que registra
  if (auth.res) return auth.res
  try {
    const form = await req.formData()
    const file = form.get('file')
    const memberId = String(form.get('member_id') ?? '')
    const groupId = String(form.get('group_id') ?? '')
    const reference = (String(form.get('reference') ?? '')).trim() || null

    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Falta el comprobante.' }, { status: 400 })
    if (!memberId || !groupId) return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 })
    if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'El archivo supera 8 MB.' }, { status: 400 })

    const supabase = createAdminClient()

    // Resolver inscripción + costo del plan (monto esperado).
    const { data: enr } = await supabase
      .from('study_enrollments')
      .select('id, group:study_groups(plan:study_plans(cost))')
      .eq('member_id', memberId).eq('group_id', groupId)
      .order('enrolled_at', { ascending: false })
      .limit(1).maybeSingle()
    const enrRow = enr as { id: string; group: { plan: { cost: number | null } | { cost: number | null }[] | null } | { plan: unknown }[] | null } | null
    if (!enrRow) return NextResponse.json({ error: 'No se encontró la matrícula.' }, { status: 404 })
    const grp = Array.isArray(enrRow.group) ? enrRow.group[0] : enrRow.group
    const plan = grp ? (Array.isArray(grp.plan) ? grp.plan[0] : grp.plan) : null
    const amount = Number((plan as { cost: number | null } | null)?.cost ?? 0)

    // Subir comprobante al bucket PRIVADO (service role).
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `${memberId}/${crypto.randomUUID()}.${ext}`
    const bytes = new Uint8Array(await file.arrayBuffer())
    const { error: upErr } = await supabase.storage
      .from(PAYMENT_RECEIPTS_BUCKET)
      .upload(path, bytes, { contentType: file.type || 'application/octet-stream', upsert: false })
    if (upErr) {
      console.error('upload receipt:', upErr.message)
      return NextResponse.json({ error: 'No se pudo subir el comprobante.' }, { status: 500 })
    }

    const { id } = await createComprobantePayment({
      member_id: memberId,
      amount,
      concept: 'matricula',
      enrollment_id: enrRow.id,
      study_group_id: groupId,
      reference_code: reference,
      receipt_path: path,
    })
    return NextResponse.json({ ok: true, id }, { status: 201 })
  } catch (error) {
    console.error('POST /api/payments:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
