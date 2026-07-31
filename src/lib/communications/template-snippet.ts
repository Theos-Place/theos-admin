// Resumen legible del cuerpo de una plantilla, para las tarjetas del listado.
// Sin esto, una plantilla de HTML avanzado (las de correo lo son) muestra un
// muro de markup y no se distingue una de otra.

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#39;': "'", '&aacute;': 'á', '&eacute;': 'é', '&iacute;': 'í',
  '&oacute;': 'ó', '&uacute;': 'ú', '&ntilde;': 'ñ', '&iquest;': '¿',
  '&middot;': '·', '&rarr;': '→', '&copy;': '©',
}

/** Texto plano del cuerpo: sin comentarios, sin <style>/<script>, sin etiquetas
 *  y sin espacios de sobra. Devuelve '' si no queda nada visible. */
export function templateSnippet(body: string | null | undefined, maxLength = 160): string {
  if (!body) return ''
  let text = body
    // Los comentarios suelen ser NOTAS PARA QUIEN EDITA ("no borres este
    // token"), nunca contenido: fuera del resumen.
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
    // Un salto real donde el HTML corta párrafo, para no pegar palabras.
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
  for (const [entity, char] of Object.entries(ENTITIES)) {
    text = text.split(entity).join(char)
  }
  text = text
    // Marcas de WhatsApp (*negrita*, _cursiva_) fuera del resumen.
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text
}
