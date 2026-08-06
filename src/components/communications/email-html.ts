/**
 * ¿El HTML es "avanzado", o sea de los que el editor visual DESTRUYE?
 *
 * TipTap parsea el HTML contra su esquema y devuelve solo lo que ese esquema
 * sabe representar: <p>, <strong>, <em>, <u>, <h1-3>, listas, <a>, <img>. Todo lo
 * demás —tablas, <div>, <span>, cualquier style en línea, clases, <style>,
 * comentarios condicionales de Outlook— se pierde en la PRIMERA TECLA. Y nuestras
 * plantillas son exactamente eso, porque las tablas con estilos en línea son lo
 * único que renderiza parejo en los clientes de correo.
 *
 * ANTE LA DUDA, AVANZADO. Es muchísimo peor destruir una plantilla en silencio
 * que obligar a alguien a editar en modo código.
 *
 * Hueco que tenía esta función hasta el 2026-08-06: buscaba `style` como TAG,
 * así que un `<p style="color:#EF5554;font-size:18px">` pasaba por "simple" y el
 * editor lo aplanaba.
 *
 * Vive en su propio módulo (sin dependencias) para que importarlo NO arrastre
 * TipTap al bundle: el editor se carga con `next/dynamic` (EmailEditorLazy).
 */

/** Cada patrón, con su nombre, para poder explicar POR QUÉ se marcó avanzado. */
const SENALES: Array<{ motivo: string; re: RegExp }> = [
  // Estructura que el esquema de TipTap no tiene.
  { motivo: 'tablas', re: /<\s*(table|thead|tbody|tfoot|tr|td|th)[\s>/]/i },
  { motivo: 'contenedores <div>/<span>', re: /<\s*(div|span)[\s>/]/i },
  { motivo: 'documento HTML completo', re: /<\s*(html|head|body)[\s>/]|<!doctype/i },
  { motivo: 'etiquetas de presentación', re: /<\s*(center|font)[\s>/]/i },
  // Estilos: el hueco viejo. El atributo style= se evalúa aparte (ver
  // tieneEstiloAvanzado) porque el propio editor visual emite algunos.
  { motivo: 'bloque <style>', re: /<\s*style[\s>]/i },
  { motivo: 'clases CSS', re: /\sclass\s*=\s*["']/i },
  // Correo de verdad: Outlook y compañía.
  { motivo: 'comentarios condicionales de Outlook', re: /<!--\s*\[if\b/i },
  { motivo: 'atributos de tabla (bgcolor, cellpadding…)', re: /\s(bgcolor|cellpadding|cellspacing|valign|align\s*=\s*["'](?:center|left|right)["'])/i },
  { motivo: 'imágenes de fondo o VML', re: /<\s*v:|background\s*=\s*["']/i },
]

/** Propiedades CSS que el PROPIO editor visual escribe y sabe volver a leer:
 *  la alineación de párrafos, el color de los enlaces y el tamaño de las
 *  imágenes. Un style hecho solo de estas NO vuelve avanzado al contenido.
 *
 *  Por qué no basta con "cualquier style= es avanzado" (que sería lo más
 *  conservador): TipTap emite `style="text-align: center"` al centrar un
 *  párrafo, así que esa regla dejaría el editor visual en modo código a mitad
 *  de escribir. Cualquier OTRA propiedad —font-size, padding, background,
 *  font-family, width…— sí es diseño que el editor no sabe conservar. */
const ESTILOS_DEL_EDITOR = new Set(['text-align', 'color', 'max-width', 'height'])

/** ¿Algún atributo style= trae propiedades que el editor visual no conserva? */
function estiloAvanzado(html: string): boolean {
  for (const m of html.matchAll(/\sstyle\s*=\s*("([^"]*)"|'([^']*)')/gi)) {
    const decls = (m[2] ?? m[3] ?? '').split(';')
    for (const d of decls) {
      const prop = d.split(':')[0]?.trim().toLowerCase()
      if (prop && !ESTILOS_DEL_EDITOR.has(prop)) return true
    }
  }
  return false
}

/** Muchas entidades numéricas (&#8203;, &#160;…) casi siempre vienen de un
 *  exportador de correo, no de alguien escribiendo en el editor. */
const ENTIDADES_MIN = 5

export function isAdvancedHtml(html: string): boolean {
  return advancedHtmlReason(html) !== null
}

/** Por qué se considera avanzado, o null si es HTML simple. El motivo se le
 *  muestra al usuario: "no te dejo editarlo en visual" sin decir por qué es
 *  exactamente el tipo de cosa que hace que la gente fuerce el modo y rompa. */
export function advancedHtmlReason(html: string): string | null {
  const s = html || ''
  if (!s.trim()) return null
  for (const { motivo, re } of SENALES) {
    if (re.test(s)) return motivo
  }
  if (estiloAvanzado(s)) return 'estilos en línea'
  const entidades = s.match(/&#\d+;/g)
  if (entidades && entidades.length >= ENTIDADES_MIN) return 'entidades HTML de un exportador de correo'
  return null
}

/** En qué modo se abre el editor para este contenido.
 *  · 'html'   → solo código; el visual destruiría el diseño.
 *  · 'visual' → HTML simple, se puede editar con la barra de herramientas.
 *  Las plantillas del SISTEMA van siempre en código: llevan variables {{…}} y
 *  el layout del envío. */
export function editorModeFor(html: string, opts?: { isSystem?: boolean }): 'html' | 'visual' {
  if (opts?.isSystem) return 'html'
  return isAdvancedHtml(html) ? 'html' : 'visual'
}

/** Aviso que se muestra cuando el editor queda en modo código. */
export function advancedHtmlNotice(html: string, opts?: { isSystem?: boolean }): string {
  if (opts?.isSystem) {
    return 'Plantilla del sistema: se edita en modo código para no romper el envío automático.'
  }
  const motivo = advancedHtmlReason(html)
  return motivo
    ? `Esta plantilla tiene diseño avanzado (${motivo}); se edita en modo código para no perder el formato.`
    : 'Esta plantilla se edita en modo código.'
}

/** Texto de la confirmación cuando alguien FUERZA el modo visual igual. */
export const FORCE_VISUAL_WARNING =
  'El editor visual no sabe representar tablas, estilos en línea ni contenedores: '
  + 'en cuanto escribas algo, el diseño de esta plantilla se pierde y no se puede deshacer. '
  + '¿Seguro que querés editarla en modo visual?'
