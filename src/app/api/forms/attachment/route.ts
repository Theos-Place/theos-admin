import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { FORM_UPLOADS_BUCKET, esPathDeAdjunto } from '@/lib/forms/attachment'

// GET ?path=<uuid>.webp → redirige a una URL firmada del adjunto.
//
// Existe para que el link del export de respuestas NO caduque: el export
// escribe esta ruta, y la URL firmada —que dura minutos— se genera recién
// cuando alguien la abre. Guardar la firmada en el Excel daría un link muerto
// al día siguiente.
//
// Exige sesión: el bucket es privado porque un comprobante lleva banco y monto.
const MINUTOS = 10

export async function GET(req: NextRequest) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  const path = req.nextUrl.searchParams.get('path') ?? ''
  // Solo el nombre de archivo que genera la subida. Sin esto, un `path` con
  // ../ podría pedir un objeto de otra carpeta del bucket.
  if (!esPathDeAdjunto(path)) {
    return NextResponse.json({ error: 'Adjunto inválido' }, { status: 400 })
  }
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.storage
      .from(FORM_UPLOADS_BUCKET).createSignedUrl(path, MINUTOS * 60)
    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: 'No se encontró el adjunto' }, { status: 404 })
    }
    return NextResponse.redirect(data.signedUrl)
  } catch (error) {
    console.error('GET /api/forms/attachment:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
