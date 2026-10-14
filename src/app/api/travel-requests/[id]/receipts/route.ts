import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { rateLimit } from '@/lib/rate-limit'
import { isUuid } from '@/lib/validate'
import { createAdminClient } from '@/lib/supabase/admin'
import { verViaje } from '@/lib/supabase/queries/travel'
import { seLiquida } from '@/lib/travel/estados-del-viaje'
import { PAYMENT_RECEIPTS_BUCKET } from '@/lib/supabase/queries/payments'
import { reportarError, reportarFalla } from '@/lib/observabilidad'

/**
 * FIN-11 fase B · Subir el comprobante de UN gasto.
 *
 * Devuelve la ruta en el bucket; la fila del gasto se guarda aparte, con el
 * resto de la tabla. Separado a propósito: la persona adjunta las facturas a
 * medida que las tiene, y perder las ya subidas por un error en otra fila
 * sería la forma segura de que nadie liquide.
 *
 * Va al bucket privado `payment-receipts`, bajo `viajes/`. No se crea un
 * bucket nuevo: es el mismo tipo de contenido y un bucket más es un paso de
 * operación más que hay que acordarse de hacer en cada ambiente.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  if (!rateLimit(`comprobante-viaje:${auth.ctx.userId}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Demasiados archivos seguidos; esperá un minuto.' }, { status: 429 })
  }
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Id inválido.' }, { status: 400 })

    const viaje = await verViaje(id)
    if (!viaje) return NextResponse.json({ error: 'No se encontró el viaje.' }, { status: 404 })
    // Solo quien viajó, y solo mientras liquida: finanzas revisa, no carga
    // facturas por él.
    if (auth.ctx.memberId !== viaje.member_id) {
      return NextResponse.json({ error: 'La liquidación la llena quien viajó.' }, { status: 403 })
    }
    if (!seLiquida(viaje.status)) {
      return NextResponse.json({ error: 'Este viaje no está en liquidación.' }, { status: 409 })
    }

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 })
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo supera 8 MB.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `viajes/${id}/${crypto.randomUUID()}.${ext}`
    const bytes = new Uint8Array(await file.arrayBuffer())
    const { error: upErr } = await supabase.storage
      .from(PAYMENT_RECEIPTS_BUCKET)
      .upload(path, bytes, { contentType: file.type || 'application/octet-stream', upsert: false })
    if (upErr) {
      reportarFalla('upload comprobante de viaje:', upErr.message)
      return NextResponse.json({ error: 'No se pudo subir el archivo.' }, { status: 500 })
    }
    return NextResponse.json({ receipt_path: path }, { status: 201 })
  } catch (error) {
    reportarError('POST /api/travel-requests/[id]/receipts:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
