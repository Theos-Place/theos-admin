/**
 * ¿El HTML es "avanzado" (lo que el editor visual de TipTap destruiría)? Detecta
 * bloques <style>, tablas, documentos completos, clases CSS, etc. Sirve para
 * forzar el modo HTML-only en plantillas que NO son del sistema pero igual
 * traen HTML complejo (ej. una plantilla de marketing pegada a mano).
 *
 * Vive en su propio módulo (sin dependencias) para que importarlo NO arrastre
 * TipTap al bundle: el editor se carga con `next/dynamic` (EmailEditorLazy).
 */
export function isAdvancedHtml(html: string): boolean {
  return /<\s*(style|table|thead|tbody|tr|td|html|head|body|center|font)[\s>/]|<!doctype|class\s*=/i.test(html || '')
}
