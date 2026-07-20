import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { PAYMENT_RECEIPTS_BUCKET } from '@/lib/supabase/queries/payments'
import {
  createPrematrimonialRequest, getPrematrimonialQueue, hasCompletedN2,
} from '@/lib/supabase/queries/prematrimonial'
import { rateLimit, clientIp } from '@/lib/rate-limit'

const MAX_BYTES = 8 * 1024 * 1024

// GET: cola de solicitudes para el coordinador de estudios / finanzas.
export async function GET() {
  const auth = await requireModuleView('estudios')
  if (auth.res) return auth.res
  try {
    return NextResponse.json({ items: await getPrematrimonialQueue() })
  } catch (error) {
    console.error('GET prematrimonial:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST (multipart): crea la solicitud + el pago por comprobante. La inicia el
// miembro logueado (requester); cubre a la pareja.
export async function POST(req: NextRequest) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  const requester = auth.ctx.memberId
  if (!requester) return NextResponse.json({ error: 'No se pudo determinar el miembro.' }, { status: 400 })
  if (!rateLimit(`premat:${clientIp(req)}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Demasiadas solicitudes. Esperá un momento.' }, { status: 429 })
  }
  try {
    const form = await req.formData()
    const file = form.get('receipt')
    const referenceCode = (form.get('reference_code') as string | null)?.trim() || null
    const spouseMemberId = (form.get('spouse_member_id') as string | null)?.trim() || ''
    let logistica, ceremonia
    try {
      logistica = JSON.parse((form.get('logistica') as string) || '{}')
      ceremonia = JSON.parse((form.get('ceremonia') as string) || '{}')
    } catch {
      return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 })
    }

    // Requisito: quien inscribe debe tener cédula (bloqueante para esta acción).
    const admin = createAdminClient()
    const { data: me } = await admin.from('members').select('cedula').eq('id', requester).maybeSingle()
    if (!me?.cedula || !String(me.cedula).trim()) {
      return NextResponse.json({ error: 'Necesitás registrar tu cédula antes de inscribirte.', code: 'cedula_requerida' }, { status: 409 })
    }

    // Cónyuge: debe existir y no ser uno mismo.
    if (!spouseMemberId) return NextResponse.json({ error: 'Falta seleccionar a tu pareja.' }, { status: 400 })
    if (spouseMemberId === requester) return NextResponse.json({ error: 'No podés seleccionarte a vos mismo.' }, { status: 400 })

    // Requisito N2 para AMBOS (server-side, sobre los member_id — confiable).
    const [reqN2, spouseN2] = await Promise.all([hasCompletedN2(requester), hasCompletedN2(spouseMemberId)])
    if (!reqN2 || !spouseN2) {
      const quien = !reqN2 && !spouseN2 ? 'Ninguno de los dos tiene' : !reqN2 ? 'Vos no tenés' : 'Tu pareja no tiene'
      return NextResponse.json({ error: `${quien} el Nivel 2 completado, requisito del curso prematrimonial.`, code: 'requisito_n2' }, { status: 409 })
    }

    // Comprobante (archivo obligatorio).
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Adjuntá el comprobante de pago.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'El comprobante supera los 8MB.' }, { status: 400 })
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `prematrimonial/${crypto.randomUUID()}.${ext}`
    const buf = Buffer.from(await file.arrayBuffer())
    const { error: upErr } = await admin.storage.from(PAYMENT_RECEIPTS_BUCKET)
      .upload(path, buf, { contentType: file.type || 'application/octet-stream', upsert: false })
    if (upErr) throw upErr

    const result = await createPrematrimonialRequest({
      requesterMemberId: requester,
      spouseMemberId,
      logistica: {
        available_days: Array.isArray(logistica.available_days) ? logistica.available_days : [],
        available_times: Array.isArray(logistica.available_times) ? logistica.available_times : [],
        zones: Array.isArray(logistica.zones) ? logistica.zones : [],
        can_host: !!logistica.can_host,
        host_address: logistica.host_address ?? null,
        host_maps_url: logistica.host_maps_url ?? null,
      },
      ceremonia: {
        ceremony_date: ceremonia.ceremony_date || null,
        ceremony_date_defined: !!ceremonia.ceremony_date_defined,
        venue_defined: !!ceremonia.venue_defined,
        venue_outside_gam: !!ceremonia.venue_outside_gam,
        officiant: ceremonia.officiant ?? null,
        comments: ceremonia.comments ?? null,
      },
      receiptPath: path,
      referenceCode,
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'SOLICITUD_ACTIVA_EXISTE') {
      return NextResponse.json({ error: 'Ya tenés una solicitud de prematrimonial en curso con esta pareja.', code: 'duplicada' }, { status: 409 })
    }
    console.error('POST prematrimonial:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
