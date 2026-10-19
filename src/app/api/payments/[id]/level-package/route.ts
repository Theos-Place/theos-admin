import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireModuleView } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportarError } from '@/lib/observabilidad'
import { logAudit } from '@/lib/audit'
import { tipoPorContenido } from '@/lib/archivos/tipo-por-contenido'
import { PAYMENT_RECEIPTS_BUCKET } from '@/lib/supabase/queries/payments'
import { revisarReferencia, tieneReferenciaComparable } from '@/lib/finance/referencia-repetida'
import { admitePaquete, cadenaDesde, prepagadosDelPaquete, descripcionDelPaquete } from '@/lib/finance/paquete-de-niveles'

/**
 * Registrar el pago de un PAQUETE DE NIVELES sobre un cobro pendiente de
 * matrícula de un grupo legacy (2026-10-19). La regla vive en
 * `paquete-de-niveles.ts`.
 *
 * GET → si este cobro admite paquete y qué niveles se pueden cubrir.
 * POST (multipart) → el cobro pasa a PAGADO por el monto del paquete, con su
 * comprobante, y los niveles siguientes quedan en `niveles_prepagados` de la
 * matrícula: al cerrar el grupo, el sucesor no los cobra.
 *
 * Mismo permiso que revisar pagos: es registrar plata que entró.
 */
const ROLES = ['revision_pagos', 'finanzas']

async function cargar(id: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('payments')
    .select('id, member_id, status, review_status, concept, enrollment_id, amount, enrollment:study_enrollments!payments_enrollment_id_fkey(id, group:study_groups!study_enrollments_group_id_fkey(modalidad, plan:study_plans(code)))')
    .eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const e = (Array.isArray(data.enrollment) ? data.enrollment[0] : data.enrollment) as { id: string; group: unknown } | null
  const g = (Array.isArray(e?.group) ? (e?.group as unknown[])[0] : e?.group) as { modalidad: string | null; plan: unknown } | null
  const plan = (Array.isArray(g?.plan) ? (g?.plan as unknown[])[0] : g?.plan) as { code: string | null } | null
  return { pago: data, enrollmentId: e?.id ?? null, modalidad: g?.modalidad ?? null, planCode: plan?.code ?? null }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleView(ROLES, { action: 'edit' })
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const c = await cargar(id)
    if (!c) return NextResponse.json({ error: 'Cobro no encontrado' }, { status: 404 })
    const admite = !!c.enrollmentId && admitePaquete({ modalidad: c.modalidad, planCode: c.planCode, concept: c.pago.concept as string, status: c.pago.status as string, review_status: c.pago.review_status as string | null })
    return NextResponse.json({ admite, niveles: admite ? cadenaDesde(c.planCode) : [] })
  } catch (error) {
    reportarError('GET /api/payments/[id]/level-package:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

const esquema = z.object({
  niveles: z.array(z.string().trim().min(1)).min(2).max(8),
  amount: z.number().positive().max(1_000_000),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  reference_code: z.string().trim().min(1, 'Falta la referencia').max(80),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleView(ROLES, { action: 'edit' })
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const form = await req.formData().catch(() => null)
    if (!form) return NextResponse.json({ error: 'Se esperaba un formulario.' }, { status: 400 })
    const parsed = esquema.safeParse({
      niveles: JSON.parse(String(form.get('niveles') ?? '[]')),
      amount: Number(form.get('amount')),
      payment_date: form.get('payment_date'),
      reference_code: form.get('reference_code'),
    })
    if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Falta el comprobante.' }, { status: 400 })
    if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'El archivo supera 8 MB.' }, { status: 400 })

    const c = await cargar(id)
    if (!c) return NextResponse.json({ error: 'Cobro no encontrado' }, { status: 404 })
    if (!c.enrollmentId || !admitePaquete({ modalidad: c.modalidad, planCode: c.planCode, concept: c.pago.concept as string, status: c.pago.status as string, review_status: c.pago.review_status as string | null })) {
      return NextResponse.json({ error: 'Este cobro no admite paquete: tiene que ser una matrícula pendiente de un grupo del esquema viejo.', code: 'no_admite' }, { status: 409 })
    }
    const r = prepagadosDelPaquete(c.planCode!, parsed.data.niveles)
    if ('error' in r) return NextResponse.json({ error: r.error, code: 'niveles_invalidos' }, { status: 400 })

    const supabase = createAdminClient()
    const d = parsed.data
    if (tieneReferenciaComparable(d.reference_code)) {
      const { data: previos } = await supabase.from('payments')
        .select('id, member_id, amount, status, review_status, description, created_at').eq('reference_code', d.reference_code)
      const v = revisarReferencia({ member_id: c.pago.member_id as string, amount: d.amount },
        ((previos ?? []) as Array<{ id: string; member_id: string | null; amount: number; status: string; review_status: string | null; description: string | null; created_at: string | null }>)
          .map(x => ({ ...x, descripcion: x.description, creado: x.created_at })))
      if (v.nivel === 'bloqueo') return NextResponse.json({ error: v.mensaje, code: 'referencia_repetida' }, { status: 409 })
    }

    const bytes = await file.arrayBuffer()
    const tipo = tipoPorContenido(new Uint8Array(bytes), ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    if (!tipo) return NextResponse.json({ error: 'El comprobante tiene que ser una imagen o un PDF.' }, { status: 400 })
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }[tipo]
    const path = `${c.pago.member_id}/${crypto.randomUUID()}.${ext}`
    const { error: eUp } = await supabase.storage.from(PAYMENT_RECEIPTS_BUCKET).upload(path, bytes, { contentType: tipo, upsert: false })
    if (eUp) throw eUp

    const ahora = new Date().toISOString()
    const { data: hecho, error: eUpd } = await supabase.from('payments').update({
      amount: d.amount, status: 'paid', review_status: 'aprobado', reviewed_by: auth.ctx.memberId, reviewed_at: ahora,
      paid_at: `${d.payment_date}T12:00:00-06:00`, payment_date: d.payment_date, reference_code: d.reference_code,
      receipt_path: path, payment_method: 'comprobante', description: descripcionDelPaquete(d.niveles),
    } as never).eq('id', id).eq('status', 'pending').select('id')
    if (eUpd) { await supabase.storage.from(PAYMENT_RECEIPTS_BUCKET).remove([path]); throw eUpd }
    if (!(hecho ?? []).length) {
      await supabase.storage.from(PAYMENT_RECEIPTS_BUCKET).remove([path])
      return NextResponse.json({ error: 'El cobro cambió mientras tanto; recargá y probá de nuevo.' }, { status: 409 })
    }
    const { error: eMat } = await supabase.from('study_enrollments')
      .update({ niveles_prepagados: r.prepagados } as never).eq('id', c.enrollmentId)
    if (eMat) throw eMat
    await logAudit({
      actorUserId: auth.ctx.userId, action: 'UPDATE', entityType: 'payments', entityId: id,
      oldData: { amount: c.pago.amount, status: c.pago.status },
      newData: { paquete: d.niveles, monto: d.amount, referencia: d.reference_code, prepagados: r.prepagados },
    })
    return NextResponse.json({ ok: true, prepagados: r.prepagados })
  } catch (error) {
    reportarError('POST /api/payments/[id]/level-package:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
