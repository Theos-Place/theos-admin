// REC-1 · Lo que toca la base y el bucket para el centro de recursos.
//
// Las reglas viven en `@/lib/recursos/reglas` (puras); la evaluación de la
// audiencia, en `memberPassesRestriction` — el mismo motor de grupos y
// formularios. Acá no se decide nada nuevo: se lee, se escribe y se firma.
import { createAdminClient } from '@/lib/supabase/admin'
import { memberPassesRestriction } from '@/lib/supabase/queries/audiencia'
import { restrictionSummary } from '@/lib/audiencia/restriccion'
import {
  BUCKET_DE_RECURSOS, SEGUNDOS_DE_LA_URL, audienciaDeRecurso, estaPublicado,
} from '@/lib/recursos/reglas'
import type { TipoDeArchivo } from '@/lib/archivos/tipo-por-contenido'

export type FilaDeRecurso = {
  id: string
  title: string
  description: string | null
  category: string | null
  file_path: string
  file_name: string
  mime_type: TipoDeArchivo
  size_bytes: number
  audience: unknown
  uploaded_by: string | null
  created_at: string
  updated_at: string
}

/** Lo que viaja a la pantalla. Sin `file_path`: el archivo solo se abre por la URL firmada. */
export type Recurso = Omit<FilaDeRecurso, 'file_path' | 'audience'> & {
  publicado: boolean
  /** Para gestión: la audiencia completa y en palabras. A quien consume no le viaja. */
  audience?: unknown
  audiencia_resumen?: string
  subido_por?: string | null
}

const SELECT = 'id, title, description, category, file_path, file_name, mime_type, size_bytes, audience, uploaded_by, created_at, updated_at'

async function todas(): Promise<FilaDeRecurso[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('resources').select(SELECT)
    .order('category', { ascending: true, nullsFirst: false }).order('title').limit(2000)
  if (error) throw error
  return (data ?? []) as unknown as FilaDeRecurso[]
}

export async function getRecurso(id: string): Promise<FilaDeRecurso | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('resources').select(SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return (data ?? null) as unknown as FilaDeRecurso | null
}

/** Para consumo: lo mínimo, sin la audiencia (dice a quién va, no hace falta que lo vea todo el mundo). */
function paraConsumo(f: FilaDeRecurso): Recurso {
  const { file_path: _p, audience: _a, ...resto } = f
  void _p; void _a
  return { ...resto, publicado: true }
}

/**
 * Los recursos que ESTA persona puede ver: publicados y con una audiencia que
 * la incluye. Calculado acá, en el servidor; la pantalla solo pinta.
 *
 * Las audiencias iguales se evalúan UNA vez (firma por JSON): diez recursos
 * «para dirigentes» son una consulta, no diez.
 */
export async function recursosVisiblesPara(memberId: string): Promise<Recurso[]> {
  const publicadas = (await todas()).filter(estaPublicado)
  const veredicto = new Map<string, Promise<boolean>>()
  const pasa = (f: FilaDeRecurso) => {
    const r = audienciaDeRecurso(f.audience)
    const firma = JSON.stringify(r)
    if (!veredicto.has(firma)) veredicto.set(firma, memberPassesRestriction(memberId, r))
    return veredicto.get(firma)!
  }
  const marcas = await Promise.all(publicadas.map(pasa))
  return publicadas.filter((_, i) => marcas[i]).map(paraConsumo)
}

/** Para gestión: todo, con la audiencia y quién lo subió. */
export async function recursosParaGestion(): Promise<Recurso[]> {
  const filas = await todas()
  const ids = [...new Set(filas.map(f => f.uploaded_by).filter((x): x is string => !!x))]
  const nombres = new Map<string, string>()
  if (ids.length) {
    const supabase = createAdminClient()
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await supabase.from('members').select('id, first_name, last_name').in('id', ids.slice(i, i + 200))
      if (error) throw error
      for (const m of (data ?? []) as Array<{ id: string; first_name: string; last_name: string }>) {
        nombres.set(m.id, `${m.first_name} ${m.last_name}`.trim())
      }
    }
  }
  return filas.map(f => {
    const { file_path: _p, ...resto } = f
    void _p
    const aud = audienciaDeRecurso(f.audience)
    return {
      ...resto,
      audience: aud,
      publicado: estaPublicado(f),
      audiencia_resumen: restrictionSummary(aud),
      subido_por: f.uploaded_by ? (nombres.get(f.uploaded_by) ?? null) : null,
    }
  })
}

/** ¿Esta persona está en la audiencia de este recurso? false si no está publicado. */
export async function pasaLaAudiencia(memberId: string, f: FilaDeRecurso): Promise<boolean> {
  if (!estaPublicado(f)) return false
  return memberPassesRestriction(memberId, audienciaDeRecurso(f.audience))
}

/** Paso 1 de la subida: el token para que el navegador suba UN archivo a esta ruta. */
export async function permisoDeSubida(path: string): Promise<string> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.storage.from(BUCKET_DE_RECURSOS).createSignedUploadUrl(path)
  if (error || !data?.token) throw error ?? new Error('No se pudo autorizar la subida')
  return data.token
}

/**
 * Lo que de verdad quedó en el bucket: los primeros bytes (para reconocer el
 * tipo por el contenido) y el tamaño. null si el archivo no está.
 *
 * Se piden SOLO los primeros 16 bytes con un Range sobre una URL firmada: para
 * saber si es un PDF no hace falta bajar 15 MB a la función.
 */
export async function inspeccionarArchivo(path: string): Promise<{ inicio: Uint8Array; tamano: number } | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.storage.from(BUCKET_DE_RECURSOS).createSignedUrl(path, 60)
  if (error || !data?.signedUrl) return null
  const res = await fetch(data.signedUrl, { headers: { Range: 'bytes=0-15' } })
  if (!res.ok) return null
  const inicio = new Uint8Array(await res.arrayBuffer()).slice(0, 16)
  // 206 trae el total en Content-Range («bytes 0-15/123456»); un 200 sin Range, en Content-Length.
  const total = Number(res.headers.get('content-range')?.split('/')[1] ?? res.headers.get('content-length') ?? 0)
  return { inicio, tamano: total }
}

export async function borrarArchivo(path: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.storage.from(BUCKET_DE_RECURSOS).remove([path])
  if (error) throw error
}

/** La URL firmada, corta. `descargar` pone el nombre original en la descarga. */
export async function firmarArchivo(f: FilaDeRecurso, descargar: boolean): Promise<string> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.storage.from(BUCKET_DE_RECURSOS)
    .createSignedUrl(f.file_path, SEGUNDOS_DE_LA_URL, descargar ? { download: f.file_name } : undefined)
  if (error || !data?.signedUrl) throw error ?? new Error('No se pudo firmar el archivo')
  return data.signedUrl
}
