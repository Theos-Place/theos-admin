import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const BUCKET = 'email-images'
const MAX_BYTES = 2 * 1024 * 1024 // 2MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' }

// Sube una imagen para usar en correos. Devuelve la URL PÚBLICA absoluta (los
// clientes de correo no pueden acceder a recursos privados/relativos). Solo
// roles de comunicaciones/dirección (admin pasa siempre).
export async function POST(req: NextRequest) {
  const auth = await requireRoles('comunicaciones', 'direccion')
  if (auth.res) return auth.res
  try {
    const form = await req.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: 'Formato no permitido. Usá JPG, PNG, GIF o WEBP.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'La imagen supera el máximo de 2 MB.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const ext = EXT[file.type] ?? 'bin'
    // Nombre único sin Date.now()/random server-only issues: usa timestamp + slug.
    const stamp = Date.now()
    const path = `${stamp}-${Math.round(stamp % 100000)}.${ext}`
    const bytes = new Uint8Array(await file.arrayBuffer())
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type,
      upsert: false,
    })
    if (error) throw error
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl })
  } catch (error) {
    console.error('POST /api/communications/upload-image:', error)
    return NextResponse.json({ error: 'No se pudo subir la imagen. Intentá de nuevo.' }, { status: 500 })
  }
}
