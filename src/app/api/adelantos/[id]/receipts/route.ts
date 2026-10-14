import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { rateLimit } from '@/lib/rate-limit'
import { isUuid } from '@/lib/validate'
import { createAdminClient } from '@/lib/supabase/admin'
import { verAdelanto } from '@/lib/supabase/queries/adelantos'
import { alcanceDeSedes } from '../../route'
import { PAYMENT_RECEIPTS_BUCKET } from '@/lib/supabase/queries/payments'
import { reportarError, reportarFalla } from '@/lib/observabilidad'

/** FIN-12 · La foto de UNA factura. Devuelve la ruta; la factura se guarda aparte. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  if (!rateLimit(`factura-adelanto:${auth.ctx.userId}`, 30, 60_000)) return NextResponse.json({ error: 'Demasiados archivos seguidos; esperá un minuto.' }, { status: 429 })
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Id inválido.' }, { status: 400 })
    const a = await verAdelanto(id)
    if (!a) return NextResponse.json({ error: 'No se encontró el adelanto.' }, { status: 404 })
    const alcance = await alcanceDeSedes(auth.ctx)
    if (!alcance.todas && !alcance.sedes.includes(a.sede_code)) return NextResponse.json({ error: 'Esa sede no es tuya.' }, { status: 403 })
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
