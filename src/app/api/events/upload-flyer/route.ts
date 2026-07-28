import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'

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
  const auth = await requireRoles('direccion', 'encargado_staff', 'comunicaciones')
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

    const supabase = createAdminClient()
    const ext = EXT[file.type] ?? 'bin'
    const path = `${crypto.randomUUID()}.${ext}`
    const bytes = new Uint8Array(await file.arrayBuffer())
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type,
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
