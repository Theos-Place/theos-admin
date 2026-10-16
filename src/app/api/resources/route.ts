import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportarError } from '@/lib/observabilidad'
import { tipoPorContenido } from '@/lib/archivos/tipo-por-contenido'
import {
  TIPOS_DE_ARCHIVO, TAMANO_MAXIMO, audienciaDeRecurso, gestionaRecursos, rutaDelArchivo,
} from '@/lib/recursos/reglas'
import {
  recursosVisiblesPara, recursosParaGestion, subirArchivo, getRecurso,
} from '@/lib/supabase/queries/resources'

/**
 * REC-1 · Centro de recursos.
 *
 * GET: lo que la persona puede ver (publicado y con su audiencia), calculado
 * acá. Con `?gestion=1`, todo — solo para quien gestiona recursos.
 * POST: subir un recurso (multipart). Solo el permiso `recursos`.
 */
export async function GET(req: NextRequest) {
  // Solo sesión: cualquiera con cuenta abre la biblioteca; lo que ve lo
  // decide la audiencia de cada recurso, evaluada acá abajo.
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const gestiona = gestionaRecursos(auth.ctx.roles)
    if (new URL(req.url).searchParams.get('gestion') === '1') {
      if (!gestiona) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      return NextResponse.json({ items: await recursosParaGestion(), gestiona })
    }
    const items = auth.ctx.memberId ? await recursosVisiblesPara(auth.ctx.memberId) : []
    return NextResponse.json({ items, gestiona })
  } catch (error) {
    reportarError('GET /api/resources:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

const campos = z.object({
  title: z.string().trim().min(1, 'Falta el título').max(200),
  description: z.string().trim().max(2000).optional().transform(v => v || null),
  category: z.string().trim().max(80).optional().transform(v => v || null),
  audience: z.string().optional().transform((v, ctx) => {
    if (!v) return null
    try { return JSON.parse(v) as unknown } catch { ctx.addIssue({ code: 'custom', message: 'Audiencia inválida' }); return z.NEVER }
  }),
})

export async function POST(req: NextRequest) {
  const auth = await requireModuleView('recursos', { action: 'create' })
  if (auth.res) return auth.res
  try {
    const form = await req.formData().catch(() => null)
    if (!form) return NextResponse.json({ error: 'Se esperaba un formulario con el archivo.' }, { status: 400 })
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 })
    }
    if (file.size > TAMANO_MAXIMO) {
      return NextResponse.json({ error: 'El archivo supera los 15 MB.', code: 'muy_grande' }, { status: 400 })
    }
    const parsed = campos.safeParse({
      title: form.get('title') ?? undefined,
      description: form.get('description') ?? undefined,
      category: form.get('category') ?? undefined,
      audience: form.get('audience') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    }
    const bytes = await file.arrayBuffer()
    // El tipo REAL, por el contenido: el MIME y la extensión los decide quien sube.
    const tipo = tipoPorContenido(new Uint8Array(bytes), TIPOS_DE_ARCHIVO)
    if (!tipo) {
      return NextResponse.json({ error: 'Solo se aceptan PDF e imágenes (PNG, JPG o WebP).', code: 'tipo_no_permitido' }, { status: 400 })
    }

    const id = crypto.randomUUID()
    const path = rutaDelArchivo(id, tipo)
    // Primero el archivo: si falla, no queda una fila apuntando a la nada.
    await subirArchivo(path, bytes, tipo)

    const supabase = createAdminClient()
    const audiencia = audienciaDeRecurso(parsed.data.audience)
    const { error } = await supabase.from('resources').insert({
      id, title: parsed.data.title, description: parsed.data.description, category: parsed.data.category,
      file_path: path, file_name: file.name.slice(0, 200) || path, mime_type: tipo, size_bytes: file.size,
      audience: audiencia, uploaded_by: auth.ctx.memberId,
    } as never)
    if (error) {
      // Sin fila, el archivo sería un huérfano: se borra ya.
      await supabase.storage.from('resources').remove([path]).catch(() => {})
      throw error
    }
    await supabase.from('audit_log').insert({
      actor_id: auth.ctx.memberId, action: 'INSERT', entity_type: 'resources', entity_id: id,
      new_data: { title: parsed.data.title, category: parsed.data.category, file_name: file.name, publicado: !!audiencia },
    })
    const creado = await getRecurso(id)
    const { file_path: _p, ...resto } = creado!
    void _p
    return NextResponse.json({ ...resto, publicado: !!audiencia }, { status: 201 })
  } catch (error) {
    reportarError('POST /api/resources:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
