/**
 * QA-2/M3 · Barrido ESTÁTICO de campos sin etiqueta (2026-10-15).
 *
 * Un `<select>`, `<input>` o `<textarea>` tiene nombre si: tiene `aria-label`,
 * `aria-labelledby`, `title` o `placeholder` (axe acepta los dos últimos);
 * está DENTRO de un `<label>`; o tiene un `id` que algún `<label htmlFor>` del
 * mismo archivo apunta. Lo demás queda mudo para un lector de pantalla: dice
 * «cuadro combinado» y nada más.
 *
 * Heurística, igual que controles-sin-nombre: no ve un nombre que llegue por
 * props (`{...props}` se da por bueno). Módulo PURO.
 */
export type CampoSinEtiqueta = { linea: number; tag: string }

function finDeApertura(src: string, i: number): number {
  let llaves = 0
  let comilla: string | null = null
  for (let j = i; j < src.length; j++) {
    const ch = src[j]
    if (comilla) { if (ch === comilla && src[j - 1] !== '\\') comilla = null; continue }
    if (ch === '"' || ch === "'" || ch === '`') { comilla = ch; continue }
    if (ch === '{') llaves++
    else if (ch === '}') llaves--
    else if (ch === '>' && llaves === 0) return j
  }
  return -1
}

/** Comentarios fuera, conservando los saltos de línea (y con ellos los números). */
function sinComentarios(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, m => m.replace(/[^\n]/g, ' '))
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`])\/\/[^\n]*/g, (m, a) => a + ' '.repeat(m.length - a.length))
}

export function camposSinEtiqueta(texto: string): CampoSinEtiqueta[] {
  const src = sinComentarios(texto)
  const out: CampoSinEtiqueta[] = []
  // `controlId="x"`: un componente de rótulo (Campo, Nota) que pone el
  // <label htmlFor={controlId}> por dentro.
  const htmlFor = new Set([...src.matchAll(/(?:htmlFor|controlId)=(?:"([^"]+)"|\{['"`]([^'"`]+)['"`]\})/g)].map(m => m[1] ?? m[2]))
  const hayHtmlForDinamico = /htmlFor=\{(?!['"`])/.test(src)
  for (const m of src.matchAll(/<(select|input|textarea)(?=[\s>/])/g)) {
    const tag = m[1]
    const fin = finDeApertura(src, m.index! + m[0].length)
    if (fin < 0) continue
    const attrs = src.slice(m.index! + m[0].length, fin)
    if (/\baria-label(ledby)?=|\btitle=|\bplaceholder=|(?:^|\s)\{\s*\.\.\./.test(attrs)) continue
    if (tag === 'input' && /\btype=["'](hidden|submit|button|reset|image)["']/.test(attrs)) continue
    // Un input de archivo con display:none no está en el árbol accesible: lo
    // dispara un botón con nombre. Con `sr-only` SÍ está, y necesita nombre.
    if (/\bclassName=["'][^"']*(?<![\w-])hidden(?![\w-])/.test(attrs)) continue
    const id = attrs.match(/\bid=(?:"([^"]+)"|\{['"`]([^'"`]+)['"`]\})/)
    if (id && htmlFor.has(id[1] ?? id[2])) continue
    // id dinámico (id={campoId}) con algún htmlFor dinámico en el archivo: se da por asociado
    if (/\bid=\{(?!['"`])/.test(attrs) && hayHtmlForDinamico) continue
    // ¿Está dentro de un <label>…</label>?
    const antes = src.slice(0, m.index)
    const abre = antes.lastIndexOf('<label')
    if (abre >= 0 && antes.indexOf('</label>', abre) < 0) continue
    out.push({ linea: antes.split('\n').length, tag })
  }
  return out
}
