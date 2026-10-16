import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireModuleView } from '@/lib/auth/guard'
import { reportarError } from '@/lib/observabilidad'
import { TIPOS_DE_ARCHIVO, TAMANO_MAXIMO, rutaDelArchivo } from '@/lib/recursos/reglas'
import { permisoDeSubida } from '@/lib/supabase/queries/resources'

/**
 * REC-1 · Paso 1 de la subida: un permiso firmado para subir UN archivo
 * directo al bucket.
 *
 * POR QUÉ EXISTE (2026-10-16): la primera versión mandaba el archivo por la
 * función de Vercel, y Vercel corta toda solicitud de más de 4,5 MB con un
 * 413 antes de que llegue a la app. Floriana no pudo subir un PDF y la
 * pantalla solo dijo «No se pudo guardar». Ahora el archivo va del navegador a
 * Storage; acá solo se autoriza y se fija la ruta.
 *
 * La RUTA la decide el servidor (un id nuevo + la extensión del tipo
 * declarado): el navegador no elige dónde escribe. El bucket hace cumplir el
 * tope y los tipos, y el paso 3 (POST /api/resources) mira el contenido real.
 */
const esquema = z.object({
  size_bytes: z.number().int().positive().max(TAMANO_MAXIMO, 'El archivo supera los 15 MB.'),
  mime_type: z.enum(TIPOS_DE_ARCHIVO as [string, ...string[]]),
}).strict()

export async function POST(req: NextRequest) {
  const auth = await requireModuleView('recursos', { action: 'create' })
  if (auth.res) return auth.res
  try {
    const parsed = esquema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    }
    const id = crypto.randomUUID()
    const path = rutaDelArchivo(id, parsed.data.mime_type as (typeof TIPOS_DE_ARCHIVO)[number])
    const token = await permisoDeSubida(path)
    return NextResponse.json({ id, path, token }, { status: 201 })
  } catch (error) {
    reportarError('POST /api/resources/upload-urls:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
