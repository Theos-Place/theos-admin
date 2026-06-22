/**
 * Convierte el cuerpo de un correo a HTML según su formato.
 *
 * - 'html': el texto YA es HTML (lo escribió quien redactó), se envía tal cual.
 * - 'text': texto plano escrito por una persona; se escapa para que no se
 *   interprete como markup y los saltos de línea se vuelven <br>.
 *
 * Se aplica DESPUÉS de sustituir variables ({nombre}), para que el nombre
 * inyectado también quede escapado en modo texto.
 */
export type BodyFormat = 'text' | 'html'

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function textToHtml(text: string): string {
  return escapeHtml(text).replace(/\r\n|\r|\n/g, '<br>')
}

export function bodyToHtml(body: string, format: BodyFormat): string {
  return format === 'html' ? body : textToHtml(body)
}
