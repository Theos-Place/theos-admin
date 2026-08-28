import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { anchoDestino, valeLaPena, resumenOptimizacion, CALIDAD } from '@/lib/images/optimize'

export const runtime = 'nodejs'

// Imagen adjunta a la respuesta de un formulario (pensado para comprobantes).
//
// Bucket PRIVADO 'form-uploads', igual que payment-receipts y no que
// event-flyers: un comprobante lleva el banco, el monto y a veces el nombre de
// la persona. Un bucket público con nombres UUID es seguridad por oscuridad, y
// para un flyer alcanza pero para esto no.
//
// Se guarda el PATH, no una URL. Quien tenga que verlo pasa por
// /api/forms/attachment, que exige sesión y firma la URL al momento — así el
// link del export no caduca ni queda abierto al mundo.
//
// Lo sube quien RESPONDE el formulario, así que el gate es tener sesión y no un
// rol: el que contesta es cualquier miembro. Pesa igual que el flyer (5 MB).
const BUCKET = 'form-uploads'
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export async function POST(req: NextRequest) {
  // requireRoles() sin roles = solo exige sesión, que es el patrón del repo
  // para lo que puede hacer cualquier miembro.
  const auth = await requireRoles()
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
      return NextResponse.json({ error: 'La imagen supera el máximo de 5 MB.' }, { status: 400 })
    }

    const original = new Uint8Array(await file.arrayBuffer())

    // Misma optimización que el flyer (ver lib/images/optimize.ts). Si sharp
    // falla se sube el original: perder la optimización es un archivo pesado;
    // no poder adjuntar el comprobante es no poder terminar el formulario.
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
        console.info('adjunto de formulario optimizado:', resumenOptimizacion(
          { width: meta.width ?? 0, height: meta.height ?? 0, bytes: original.byteLength },
          { width: salida.info.width, height: salida.info.height, bytes: salida.data.byteLength },
        ))
      }
    } catch (e) {
      console.warn('no se pudo optimizar el adjunto, se sube el original:', e)
    }

    const supabase = createAdminClient()
    const path = `${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false })
    if (error) throw error
    // La respuesta del formulario guarda ESTO: un path, no una URL. La URL se
    // firma al abrirla (ver /api/forms/attachment).
    return NextResponse.json({ path })
  } catch (error) {
    console.error('POST /api/forms/upload-attachment:', error)
    return NextResponse.json({ error: 'No se pudo subir la imagen. Intentá de nuevo.' }, { status: 500 })
  }
}
