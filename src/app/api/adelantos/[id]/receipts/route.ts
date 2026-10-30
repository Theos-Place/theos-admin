import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { rateLimit } from '@/lib/rate-limit'
import { isUuid } from '@/lib/validate'
import { createAdminClient } from '@/lib/supabase/admin'
import { verAdelanto, urlDeFoto } from '@/lib/supabase/queries/adelantos'
import { alcanceDeSedes, dentroDelAlcance } from '../../route'
import { PAYMENT_RECEIPTS_BUCKET } from '@/lib/supabase/queries/payments'
import { reportarError, reportarFalla } from '@/lib/observabilidad'

/** FIN-12 · La foto de UNA factura. Devuelve la ruta; la factura se guarda aparte. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Solo sesión: la sede del adelanto tiene que ser una que la persona atiende (alcanceDeSedes, abajo); el rol no alcanza porque el acceso sale del PUESTO.
  const auth = await requireRoles()
  if (auth.res) return auth.res
  if (!rateLimit(`factura-adelanto:${auth.ctx.userId}`, 30, 60_000)) return NextResponse.json({ error: 'Demasiados archivos seguidos; esperá un minuto.' }, { status: 429 })
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Id inválido.' }, { status: 400 })
    const a = await verAdelanto(id)
    if (!a) return NextResponse.json({ error: 'No se encontró el adelanto.' }, { status: 404 })
    const alcance = await alcanceDeSedes(auth.ctx)
    if (!dentroDelAlcance(alcance, a.sede_code, a.tipo)) return NextResponse.json({ error: 'Esa sede o ese tipo no es tuyo.' }, { status: 403 })
    if (a.estado === 'cerrado') return NextResponse.json({ error: 'Este mes ya está cerrado.' }, { status: 409 })
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 })
    if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'El archivo supera 8 MB.' }, { status: 400 })
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `adelantos/${id}/${crypto.randomUUID()}.${ext}`
    const { error } = await createAdminClient().storage.from(PAYMENT_RECEIPTS_BUCKET)
      .upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: file.type || 'application/octet-stream', upsert: false })
    if (error) { reportarFalla('upload factura adelanto:', error.message); return NextResponse.json({ error: 'No se pudo subir el archivo.' }, { status: 500 }) }
    return NextResponse.json({ receipt_path: path }, { status: 201 })
  } catch (error) {
    reportarError('POST /api/adelantos/[id]/receipts:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * FIN-16 · GET ?factura_id= — un link temporal a la foto de UNA factura, para
 * el «ver detalle». Andrés dejaba de encontrar el número de factura en el
 * correo: la foto queda junto a la factura.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const facturaId = req.nextUrl.searchParams.get('factura_id') ?? ''
    if (!isUuid(id) || !isUuid(facturaId)) return NextResponse.json({ error: 'Id inválido.' }, { status: 400 })
    const a = await verAdelanto(id)
    if (!a) return NextResponse.json({ error: 'No se encontró el presupuesto.' }, { status: 404 })
    if (!dentroDelAlcance(await alcanceDeSedes(auth.ctx), a.sede_code, a.tipo)) return NextResponse.json({ error: 'Esa sede o ese tipo no es tuyo.' }, { status: 403 })
    const f = a.facturas.find(x => x.id === facturaId)
    if (!f) return NextResponse.json({ error: 'No se encontró la factura.' }, { status: 404 })
    if (!f.receipt_path) return NextResponse.json({ error: 'Esta factura no tiene foto.' }, { status: 404 })
    const url = await urlDeFoto(f.receipt_path)
    if (!url) return NextResponse.json({ error: 'No se pudo abrir la foto.' }, { status: 502 })
    return NextResponse.json({ url, es_pdf: /\.pdf$/i.test(f.receipt_path) })
  } catch (error) {
    reportarError('GET /api/adelantos/[id]/receipts:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
