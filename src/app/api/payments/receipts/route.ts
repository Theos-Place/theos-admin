import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { rateLimit } from '@/lib/rate-limit'
import { isUuid } from '@/lib/validate'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyEnrollment } from '@/lib/email/enrollment-notify'
import {
  submitComprobanteCompartido, gruposDeMatriculaDe,
  PAYMENT_RECEIPTS_BUCKET, ReferenciaYaUsada, SeleccionInvalida,
} from '@/lib/supabase/queries/payments'
import { MAXIMO_POR_COMPROBANTE } from '@/lib/finance/comprobante-multiple'
import { reportarError, reportarFalla } from '@/lib/observabilidad'

/**
 * PAG-5 · POST (multipart) — un comprobante para VARIOS cobros.
 *
 * Campos: `file`, `reference`, `payment_ids` (JSON array) y `member_id` (de
 * quién son los cobros; puede ser un familiar).
 *
 * Los montos NO vienen del cliente: se leen de los pagos y se suman en el
 * servidor. Mandar el total desde la pantalla sería dejar que quien paga
 * declare cuánto pagó.
 */
export async function POST(req: NextRequest) {
  const auth = await requireRoles() // Solo sesión: la autorización fina va abajo (la propia persona, su familia o staff para el member_id).
  if (auth.res) return auth.res
  if (!rateLimit(`comprobante-multiple:${auth.ctx.userId}`, 3, 60_000)) {
    return NextResponse.json({ error: 'Demasiados comprobantes seguidos; esperá un minuto.' }, { status: 429 })
  }
  try {
    const form = await req.formData()
    const file = form.get('file')
    const reference = (String(form.get('reference') ?? '')).trim() || null
    const memberId = String(form.get('member_id') ?? '')

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Falta el comprobante.' }, { status: 400 })
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo supera 8 MB.' }, { status: 400 })
    }
    if (!isUuid(memberId)) return NextResponse.json({ error: 'Falta la persona.' }, { status: 400 })

    let ids: unknown
    try { ids = JSON.parse(String(form.get('payment_ids') ?? '[]')) } catch { ids = null }
    if (!Array.isArray(ids) || ids.length < 2 || ids.length > MAXIMO_POR_COMPROBANTE
      || !ids.every(x => typeof x === 'string' && isUuid(x))) {
      return NextResponse.json({ error: 'Elegí entre 2 y ' + MAXIMO_POR_COMPROBANTE + ' cobros.' }, { status: 400 })
    }
    const paymentIds = [...new Set(ids as string[])]

    // Anti-suplantación: o son cobros propios, o de alguien de la familia, o
    // quien sube es staff de finanzas. El `member_id` del body NO alcanza:
    // es justo el dato que un cliente puede cambiar.
    const supabase = createAdminClient()
    const esStaff = auth.ctx.roles.includes('admin') || auth.ctx.roles.includes('finanzas')
    //
    // NO se usa `canViewMemberProfile`: ese permiso incluye «comparten un
    // comité que yo encargo», que sirve para VER una ficha y no para subir
    // un pago a nombre de alguien. Acá son solo los dos casos reales: mis
    // cobros, o los de mi familia (es la misma puerta por la que la pantalla
    // de Mis pagos ya muestra las pestañas de familiares).
    let permitido = esStaff || auth.ctx.memberId === memberId
    if (!permitido && auth.ctx.memberId) {
      const { data: propias } = await supabase
        .from('family_members').select('family_unit_id').eq('member_id', auth.ctx.memberId)
      const unidades = (propias ?? []).map(r => (r as { family_unit_id: string }).family_unit_id)
      if (unidades.length > 0) {
        const { data: juntos } = await supabase
          .from('family_members').select('member_id')
          .in('family_unit_id', unidades).eq('member_id', memberId).limit(1)
        permitido = (juntos ?? []).length > 0
      }
    }
    if (!permitido) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `${memberId}/${crypto.randomUUID()}.${ext}`
    const bytes = new Uint8Array(await file.arrayBuffer())
    const { error: upErr } = await supabase.storage
      .from(PAYMENT_RECEIPTS_BUCKET)
      .upload(path, bytes, { contentType: file.type || 'application/octet-stream', upsert: false })
    if (upErr) {
      reportarFalla('upload receipt (PAG-5):', upErr.message)
      return NextResponse.json({ error: 'No se pudo subir el comprobante.' }, { status: 500 })
    }

    const r = await submitComprobanteCompartido({
      payment_ids: paymentIds, member_id: memberId,
      receipt_path: path, reference_code: reference,
    })

    // El correo de bienvenida sale al PAGAR, no al matricularse (ver
    // /api/payments). Con varios cobros son varios correos, uno por grupo.
    for (const g of await gruposDeMatriculaDe(r.aplicados)) {
      try { await notifyEnrollment(g.group_id, g.member_id) } catch (e) { reportarFalla('notifyEnrollment (PAG-5):', e) }
    }

    return NextResponse.json({
      ok: true, grupo: r.grupo, total: r.total, currency: r.currency,
      aplicados: r.aplicados.length, en_revision: r.noAceptados.length,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof ReferenciaYaUsada) {
      return NextResponse.json({ error: error.message, code: 'referencia_repetida' }, { status: 409 })
    }
    if (error instanceof SeleccionInvalida) {
      // 409 cuando algo cambió por debajo; 400 cuando la selección nunca fue válida.
      const conflicto = error.code === 'no_pendiente' || error.code === 'no_existe'
      return NextResponse.json({ error: error.message, code: error.code }, { status: conflicto ? 409 : 400 })
    }
    reportarError('POST /api/payments/receipts:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
