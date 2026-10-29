/**
 * COM-5 (2026-10-29) · Ranuras de imagen en las plantillas de correo.
 *
 * Quien arma el boletín cada mes no sabe de código, y abrir la plantilla en
 * el editor visual aplana el HTML avanzado (gotcha de TipTap, ver
 * email-html.ts). Para cambiar la imagen del cuerpo sin tocar HTML, la
 * plantilla marca la imagen reemplazable con `data-imagen-slot="nombre"`;
 * la pantalla muestra cada ranura con su vista previa y un botón «Cambiar
 * imagen» que sube la nueva y reemplaza SOLO el `src` de esa etiqueta. El
 * resto del HTML queda byte-idéntico: nada pasa por el editor.
 *
 * Módulo PURO (sin DOM): trabaja sobre el texto con expresiones regulares
 * acotadas a la etiqueta <img> marcada. Con tests.
 */

export const ATRIBUTO_DE_RANURA = 'data-imagen-slot'

export type RanuraDeImagen = {
  /** El nombre que lleva el atributo. */
  slot: string
  /** La URL actual. */
  src: string
  alt: string | null
  /** El ancho declarado (atributo `width`), para recomendar el tamaño. */
  width: number | null
}

const IMG_RE = /<img\b[^>]*>/gi

function atributo(tag: string, nombre: string): string | null {
  const re = new RegExp(`\\s${nombre}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i')
  const m = re.exec(tag)
  if (!m) return null
  return m[2] ?? m[3] ?? ''
}

/** Las imágenes marcadas, en el orden en que aparecen. Sin marca = sin ranuras. */
export function ranurasDeImagen(html: string): RanuraDeImagen[] {
  const out: RanuraDeImagen[] = []
  const vistos = new Set<string>()
  for (const m of (html ?? '').matchAll(IMG_RE)) {
    const tag = m[0]
    const slot = (atributo(tag, ATRIBUTO_DE_RANURA) ?? '').trim()
    if (!slot || vistos.has(slot)) continue
    vistos.add(slot)
    const w = atributo(tag, 'width')
    out.push({
      slot,
      src: atributo(tag, 'src') ?? '',
      alt: atributo(tag, 'alt'),
      width: w && /^\d+$/.test(w.trim()) ? Number(w.trim()) : null,
    })
  }
  return out
}

/**
 * Reemplaza el `src` de la ranura y nada más. Si la ranura no existe, el
 * HTML vuelve igual (quien llama decide si eso es un error). Si la etiqueta
 * no tiene `src`, se le agrega justo después de `<img`.
 */
export function reemplazarImagenDeRanura(html: string, slot: string, nuevoSrc: string): string {
  const seguro = nuevoSrc.replace(/"/g, '&quot;')
  return (html ?? '').replace(IMG_RE, tag => {
    if ((atributo(tag, ATRIBUTO_DE_RANURA) ?? '').trim() !== slot) return tag
    const srcRe = /(\ssrc\s*=\s*)("[^"]*"|'[^']*')/i
    if (srcRe.test(tag)) return tag.replace(srcRe, (_m, pre) => `${pre}"${seguro}"`)
    return tag.replace(/^<img\b/i, `<img src="${seguro}"`)
  })
}

/** Texto del tamaño recomendado: el ancho de la imagen actual, si lo declara. */
export function tamanoRecomendado(r: Pick<RanuraDeImagen, 'width'>): string {
  return r.width ? `Tamaño recomendado: ${r.width} px de ancho (JPG o PNG, hasta 2 MB).` : 'JPG o PNG, hasta 2 MB.'
}
