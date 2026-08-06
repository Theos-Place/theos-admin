import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  HERO_BUCKET, validateHeroUpload, heroExtension,
} from '@/lib/forms/hero-upload'

export const runtime = 'nodejs'

// FRM-2 · Flyer del encabezado de un formulario, a Supabase Storage.
//
// Mismo patrón que EVE-2 (events/upload-flyer): bucket PÚBLICO, validación de
// MIME y tamaño, service role para subir, URL pública de vuelta. La imagen NUNCA
// se guarda como base64 en la columna — ese fue el problema que EVE-2 arregló.
//
// Bucket propio 'form-heroes' y no 'event-flyers': los formularios existen
// aparte de los eventos (hay de estudios, encuestas y sueltos), y un bucket que
// se llama de eventos con imágenes que no son de eventos hace imposible razonar
// después sobre qué se puede limpiar.

export async function POST(req: NextRequest) {
  // Quien puede editar el formulario puede ponerle encabezado.
  const auth = await requireModuleView('formularios', { action: 'edit' })
  if (auth.res) return auth.res
  try {
    const form = await req.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
    }
    const invalido = validateHeroUpload(file)
    if (invalido) return NextResponse.json({ error: invalido.error }, { status: invalido.status })

    const supabase = createAdminClient()
    const path = `${crypto.randomUUID()}.${heroExtension(file.type)}`
    const bytes = new Uint8Array(await file.arrayBuffer())
    const { error } = await supabase.storage.from(HERO_BUCKET).upload(path, bytes, {
      contentType: file.type,
      upsert: false,
    })
    if (error) throw error
    const { data } = supabase.storage.from(HERO_BUCKET).getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl })
  } catch (error) {
    console.error('POST /api/forms/upload-hero:', error)
    return NextResponse.json({ error: 'No se pudo subir la imagen. Intentá de nuevo.' }, { status: 500 })
  }
}
