import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { EVENT_WRITE_ROLES } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { anchoDestino, valeLaPena, resumenOptimizacion, CALIDAD } from '@/lib/images/optimize'

export const runtime = 'nodejs'

// EVE-2: flyer de eventos a Supabase Storage (antes se guardaba como data URL
// base64 dentro de events.flyer_url). Patrón de communications/upload-image.
// Bucket PÚBLICO 'event-flyers' (se crea desde el dashboard/script, los buckets
// no se declaran en migraciones en este repo). Mismos roles que gestionan eventos.

const BUCKET = 'event-flyers'
const MAX_BYTES = 5 * 1024 * 1024 // 5MB (límite que ya usaba la dropzone)
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export async function POST(req: NextRequest) {
  const auth = await requireRoles(...EVENT_WRITE_ROLES)
  if (auth.res) return auth.res
  try {
    const form = await req.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: 'Formato no permitido. Usá JPG, PNG o WEBP.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'El flyer supera el máximo de 5 MB.' }, { status: 400 })
    }

    const original = new Uint8Array(await file.arrayBuffer())

    /**
     * OPTIMIZACIÓN PARA WEB.
     *
     * Los flyers llegan tal cual salen de Canva o del celular: medido sobre los
     * que había, dos de cuatro pesaban ~1 MB con 3400 px de ancho para
     * mostrarse a menos de 800. Acá se achican a 1600 px y se pasan a WebP.
     *
     * Va en el servidor y no en el navegador para que valga por cualquier
     * camino de subida, hoy y mañana. Y va en `try`: si sharp falla —un
     * formato raro, un archivo corrupto— se sube el original. Perder la
     * optimización es un archivo más pesado; no poder subir el flyer es que
     * alguien no puede publicar su evento.
     *
     * `.rotate()` antes de redimensionar aplica la orientación del EXIF: sin
     * eso, una foto tomada de lado se guarda acostada. Y como el WebP no
     * arrastra los metadatos, de paso deja de publicarse la geolocalización que
     * traen las fotos del celular.
     */
    let bytes = original
    let contentType = file.type
    let ext = EXT[file.type] ?? 'bin'
    try {
      const sharp = (await import('sharp')).default
      const img = sharp(original, { failOn: 'none' }).rotate()
      const meta = await img.metadata()
      const destino = anchoDestino({ width: meta.width ?? 0, height: meta.height ?? 0 })
      const salida = await (destino ? img.resize({ width: destino, withoutEnlargement: true }) : img)
        .webp({ quality: CALIDAD })
        .toBuffer({ resolveWithObject: true })
      if (valeLaPena(original.byteLength, salida.data.byteLength)) {
        bytes = new Uint8Array(salida.data)
        contentType = 'image/webp'
        ext = 'webp'
        console.info('flyer optimizado:', resumenOptimizacion(
          { width: meta.width ?? 0, height: meta.height ?? 0, bytes: original.byteLength },
          { width: salida.info.width, height: salida.info.height, bytes: salida.data.byteLength },
        ))
      }
    } catch (e) {
      console.warn('no se pudo optimizar el flyer, se sube el original:', e)
    }

    const supabase = createAdminClient()
    const path = `${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType,
      upsert: false,
    })
    if (error) throw error
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl })
  } catch (error) {
    console.error('POST /api/events/upload-flyer:', error)
    return NextResponse.json({ error: 'No se pudo subir el flyer. Intentá de nuevo.' }, { status: 500 })
  }
}
