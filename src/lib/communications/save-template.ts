// Guardado de plantillas de correo: crear y editar por el MISMO camino.
//
// Antes cada pantalla tenía su `try { … } catch { setSaving(false) }` — sin toast
// y sin mensaje: si el PUT fallaba, el usuario no se enteraba y concluía "no se
// guarda" (bug 2026-08-06). Acá el fallo SIEMPRE vuelve con un motivo legible, y
// el éxito invalida la caché para que el listado no muestre la versión vieja.
import { invalidateCommsCache } from '@/lib/communications/comms-cache'

export type TemplatePayload = {
  name: string
  category: string
  subject: string | null
  body: string
  body_format: 'html' | 'text'
  /** Solo al crear. */
  channel?: string
  is_active?: boolean
}

export type SaveResult =
  | { ok: true }
  | { ok: false; error: string }

/** Mensaje humano de una respuesta que falló. Nunca devuelve string vacío: el
 *  punto de todo esto es que el usuario vea POR QUÉ. */
export async function saveErrorMessage(res: Response): Promise<string> {
  const body = await res.json().catch(() => null)
  const propio = typeof body?.error === 'string' && body.error.trim() ? body.error.trim() : null
  if (propio) return propio
  if (res.status === 401 || res.status === 403) return 'No tenés permiso para guardar esta plantilla.'
  if (res.status === 404) return 'La plantilla ya no existe (¿la borraron desde otra pestaña?).'
  if (res.status === 409) return 'Ya existe una plantilla con ese nombre.'
  return `No se pudo guardar la plantilla (error ${res.status}).`
}

/** Crea (sin id) o actualiza (con id). Invalida la caché al guardar bien. */
export async function saveTemplate(payload: TemplatePayload, id?: string): Promise<SaveResult> {
  try {
    const res = await fetch(
      id ? `/api/communications/templates/${id}` : '/api/communications/templates',
      {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )
    if (!res.ok) return { ok: false, error: await saveErrorMessage(res) }
    // Lo escrito ya no coincide con lo cacheado: la próxima lectura va al server.
    invalidateCommsCache('templates')
    return { ok: true }
  } catch (e) {
    console.error('saveTemplate:', e)
    return { ok: false, error: 'No hay conexión con el servidor. Revisá tu internet e intentá de nuevo.' }
  }
}
