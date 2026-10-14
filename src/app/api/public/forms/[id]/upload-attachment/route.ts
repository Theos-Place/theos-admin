import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import { esFormularioAbierto } from '@/lib/forms/public-access'
import { formWindowStatus, FORM_WINDOW_BLOCKED } from '@/lib/forms/active-window'
import { reportarError, reportarFalla } from '@/lib/observabilidad'

/**
 * El adjunto de un formulario PÚBLICO, sin sesión.
 *
 * QUÉ PASÓ (2026-10-14). El formulario «Matrimonios - Octubre 2026» es público
 * y sin login: cualquiera lo responde por /api/public/forms/[id]/responder.
 * Pero el campo de imagen subía SIEMPRE por /api/forms/upload-attachment, que
 * exige sesión. Resultado: la persona llenaba todo, iba a adjuntar el
 * comprobante de pago y veía «No autenticado». Dos 401 en los logs del día.
 *
 * ESTA RUTA ES LA MISMA PUERTA QUE LA DE RESPONDER, no una más abierta: solo
 * formularios públicos, sin login requerido, activos y dentro de ventana;
 * 404 si no (no se confirma que el id exista), y límite por IP. Las reglas
 * del archivo son las de la ruta con sesión: 5 MB, JPG/PNG/WEBP, bucket
 * privado `form-uploads`.
 */
const BUCKET = 'form-uploads'
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const SUBIDAS_MAX_POR_IP = 20
const VENTANA_MS = 10 * 60_000

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('forms').select('id, is_public, requires_auth, is_active, starts_at, ends_at, audience_restrictions')
      .eq('id', id).maybeSingle()
    const f = data as {
      is_public: boolean; requires_auth: boolean; is_active: boolean
      starts_at: string | null; ends_at: string | null; audience_restrictions: unknown
    } | null
    if (!f || !esFormularioAbierto(f)) return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 })
    const ventana = formWindowStatus(f)
    if (ventana !== 'activo') return NextResponse.json({ error: FORM_WINDOW_BLOCKED[ventana], code: 'formulario_cerrado' }, { status: 403 })

    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
    if (!rateLimit(`adjunto-publico:${id}:${ip || 'sin-ip'}`, SUBIDAS_MAX_POR_IP, VENTANA_MS)) {
      return NextResponse.json({ error: 'Se subieron muchos archivos desde acá. Probá de nuevo en un rato.' }, { status: 429 })
    }

    const form = await req.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
    if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'Formato no permitido. Usá JPG, PNG o WEBP.' }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'La imagen supera 5 MB.' }, { status: 400 })

    const path = `publico/${id}/${crypto.randomUUID()}.${EXT[file.type]}`
    const { error } = await supabase.storage.from(BUCKET)
      .upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, upsert: false })
    if (error) { reportarFalla('upload adjunto público:', error.message); return NextResponse.json({ error: 'No se pudo subir la imagen.' }, { status: 500 }) }
    return NextResponse.json({ path }, { status: 201 })
  } catch (error) {
    reportarError('POST /api/public/forms/[id]/upload-attachment:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
