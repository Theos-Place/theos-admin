// Adjuntos de las respuestas de un formulario (módulo puro).
//
// La respuesta guarda un PATH del bucket privado, no una URL. Acá está cómo se
// reconoce y cómo se arma el link que va al export.

export const FORM_UPLOADS_BUCKET = 'form-uploads'

/** El nombre que genera la subida: <uuid>.<ext>, sin carpetas. */
const PATH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i

/**
 * ¿Es un path de adjunto y nada más?
 *
 * Se valida con una forma exacta y no descartando "..": el bucket es privado y
 * la ruta que lo sirve corre con service role, así que un path armado a mano
 * podría pedir cualquier objeto. Una allowlist es más difícil de burlar que una
 * denylist.
 */
export function esPathDeAdjunto(path: string): boolean {
  return PATH_RE.test(path)
}

/**
 * El link que se escribe en el export de respuestas.
 *
 * Apunta a nuestra ruta y no a una URL firmada: la firmada dura minutos y en un
 * Excel que alguien abre mañana sería un link muerto. Esta pide sesión y firma
 * al momento.
 */
export function urlDeAdjunto(path: string, origin?: string): string {
  const base = (origin ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://admin.theosplace.org').replace(/\/$/, '')
  return `${base}/api/forms/attachment?path=${encodeURIComponent(path)}`
}
