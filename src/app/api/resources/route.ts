import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportarError } from '@/lib/observabilidad'
import { logAudit } from '@/lib/audit'
import { tipoPorContenido } from '@/lib/archivos/tipo-por-contenido'
import {
  TIPOS_DE_ARCHIVO, TAMANO_MAXIMO, audienciaDeRecurso, gestionaRecursos, rutaDelArchivo,
} from '@/lib/recursos/reglas'
import {
  recursosVisiblesPara, recursosParaGestion, inspeccionarArchivo, borrarArchivo, getRecurso,
} from '@/lib/supabase/queries/resources'

/**
 * REC-1 · Centro de recursos.
 *
 * GET: lo que la persona puede ver (publicado y con su audiencia), calculado
 * acá. Con `?gestion=1`, todo — solo para quien gestiona recursos.
 * POST: registrar un recurso cuyo archivo YA se subió directo al bucket con el
 * permiso de /api/resources/upload-urls (paso 3). Solo el permiso `recursos`.
 * El archivo no pasa por acá: Vercel corta las solicitudes de más de 4,5 MB.
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

const RUTA = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(pdf|png|jpg|webp)$/

const esquema = z.object({
  path: z.string().regex(RUTA, 'Ruta de archivo inválida'),
  file_name: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1, 'Falta el título').max(200),
  description: z.string().trim().max(2000).nullish().transform(v => v || null),
  category: z.string().trim().max(80).nullish().transform(v => v || null),
  audience: z.unknown().optional(),
}).strict()

export async function POST(req: NextRequest) {
  const auth = await requireModuleView('recursos', { action: 'create' })
  if (auth.res) return auth.res
  try {
    const parsed = esquema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    }
    const d = parsed.data
    const id = RUTA.exec(d.path)![1]
    if (await getRecurso(id)) return NextResponse.json({ error: 'Ese archivo ya está registrado.' }, { status: 409 })

    // Lo que de verdad quedó en el bucket, no lo que dice el navegador.
    const archivo = await inspeccionarArchivo(d.path)
    if (!archivo) return NextResponse.json({ error: 'El archivo no llegó a subirse. Probá de nuevo.', code: 'sin_archivo' }, { status: 400 })
    const tipo = tipoPorContenido(archivo.inicio, TIPOS_DE_ARCHIVO)
    // El tipo real tiene que ser el de la ruta: un .pdf que adentro no es PDF se borra.
    if (!tipo || rutaDelArchivo(id, tipo) !== d.path) {
      await borrarArchivo(d.path).catch(e => reportarError('POST /api/resources borrar rechazado:', e))
      return NextResponse.json({ error: 'Solo se aceptan PDF e imágenes (PNG, JPG o WebP).', code: 'tipo_no_permitido' }, { status: 400 })
    }
    if (archivo.tamano > TAMANO_MAXIMO) {
      await borrarArchivo(d.path).catch(e => reportarError('POST /api/resources borrar grande:', e))
      return NextResponse.json({ error: 'El archivo supera los 15 MB.', code: 'muy_grande' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const audiencia = audienciaDeRecurso(d.audience)
    const { error } = await supabase.from('resources').insert({
      id, title: d.title, description: d.description, category: d.category,
      file_path: d.path, file_name: d.file_name, mime_type: tipo, size_bytes: Math.max(1, archivo.tamano),
      audience: audiencia, uploaded_by: auth.ctx.memberId,
    } as never)
    if (error) throw error
    await logAudit({
      actorUserId: auth.ctx.userId, action: 'INSERT', entityType: 'resources', entityId: id,
      newData: { title: d.title, category: d.category, file_name: d.file_name, publicado: !!audiencia },
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
