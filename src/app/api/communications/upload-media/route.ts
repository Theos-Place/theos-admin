import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

// Sube un VIDEO (o una imagen grande) para usarlo desde un correo, y devuelve la
// URL pública. Existe aparte de /upload-image porque ese bucket es solo de
// imágenes y con tope de 2 MB.
//
// Los correos NO pueden llevar video incrustado — ningún cliente lo reproduce de
// forma confiable. El patrón que sí funciona, y el que usa la plantilla "Anuncio
// con video", es: miniatura clickeable → link al video alojado. Este endpoint
// aloja ese video en el propio sistema, sin depender de YouTube ni Vimeo.
const BUCKET = 'email-media'
const MAX_BYTES = 50 * 1024 * 1024 // 50 MB: un video corto entra de sobra
const ALLOWED: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

export async function POST(req: NextRequest) {
  const auth = await requireRoles('comunicaciones', 'direccion')
  if (auth.res) return auth.res
  try {
    const form = await req.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
    }
    const ext = ALLOWED[file.type]
    if (!ext) {
      return NextResponse.json(
        { error: 'Formato no permitido. Usá MP4, MOV o WEBM para video; JPG, PNG, GIF o WEBP para imagen.' },
        { status: 400 },
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `El archivo supera el máximo de ${MAX_BYTES / 1024 / 1024} MB.` },
        { status: 400 },
      )
    }

    const supabase = createAdminClient()
    const stamp = Date.now()
    // Se conserva parte del nombre original: ayuda a reconocer el archivo después
    // en el bucket, sin exponer nada sensible.
    const slug = (file.name || 'media').toLowerCase()
      .replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
    const path = `${stamp}-${slug || 'media'}.${ext}`
    const bytes = new Uint8Array(await file.arrayBuffer())
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type,
      upsert: false,
    })
    if (error) throw error
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl, bytes: file.size, type: file.type })
  } catch (error) {
    console.error('POST /api/communications/upload-media:', error)
    return NextResponse.json({ error: 'No se pudo subir el archivo. Intentá de nuevo.' }, { status: 500 })
  }
}
