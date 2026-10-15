/**
 * QA-2/M2 · Barrido ESTÁTICO de controles sin nombre accesible (2026-10-15).
 *
 * axe solo mide las pantallas que tienen datos en staging: encontró 50 botones
 * solo-ícono en 8 pantallas, pero el patrón está en todo el código. Esto lee
 * el JSX y marca todo `<button>`, `<Link>` o `<a>` cuyo contenido es SOLO un
 * ícono (un componente en mayúscula que se cierra solo, o un ternario entre
 * dos) y que no tiene `aria-label`, `aria-labelledby` ni `title`.
 *
 * Es una heurística y lo sabe: no ve un nombre que llegue por props desde
 * otro componente. Por eso el test la usa como trinquete y no como verdad.
 *
 * Módulo PURO: recibe el texto del archivo.
 */
export type ControlSinNombre = { linea: number; tag: string }

/** Desde `i` (justo después de `<tag`), el índice del `>` que cierra la
 *  etiqueta de apertura, saltando lo que esté entre llaves y entre comillas. */
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

/** ¿El contenido es solo íconos? Quita íconos, comentarios y las expresiones
 *  que, sin los íconos, quedaron sin valor (`{a ? : }`, `{a && }`). */
function soloIconos(contenido: string): boolean {
  if (!/<[A-Z]/.test(contenido)) return false
  // Una imagen con alt (el logo) SÍ le da nombre al enlace.
  if (/\balt=("[^"]+"|\{[^}]+\})/.test(contenido)) return false
  let c = contenido.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  for (let k = 0; k < 4; k++) {
    c = c.replace(/<[A-Z][\w.]*(?:\s+(?:[^<>{}"']|"[^"]*"|'[^']*'|\{(?:[^{}]|\{[^{}]*\})*\})*)?\s*\/>/g, '')
  }
  c = c.replace(/\{([^{}]*)\}/g, (m, expr: string) => {
    const e = expr.trim()
    if (e === '') return ''
    if (e.includes('?')) return e.slice(e.indexOf('?') + 1).split(':').every(p => p.trim() === '') ? '' : m
    if (e.includes('&&')) return e.slice(e.lastIndexOf('&&') + 2).trim() === '' ? '' : m
    return m
  })
  return c.replace(/\s+/g, '') === ''
}

/** ¿No hay texto? Solo etiquetas y expresiones de clase/estilo. */
function sinTexto(contenido: string): boolean {
  if (/\balt=/.test(contenido)) return false
  const c = contenido
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/<[^<>]*(?:\{(?:[^{}]|\{[^{}]*\})*\}[^<>]*)*>/g, '')
  return c.replace(/\s+/g, '') === ''
}

export function controlesSinNombre(src: string): ControlSinNombre[] {
  const out: ControlSinNombre[] = []
  for (const m of src.matchAll(/<(button|Link|a)(?=[\s>])/g)) {
    const tag = m[1]
    const fin = finDeApertura(src, m.index! + m[0].length)
    if (fin < 0) continue
    const attrs = src.slice(m.index! + m[0].length, fin)
    if (attrs.trimEnd().endsWith('/')) continue
    if (/\baria-label(ledby)?=|\btitle=|(?:^|\s)\{\s*\.\.\./.test(attrs)) continue
    const cierre = src.indexOf(`</${tag}>`, fin)
    if (cierre < 0) continue
    const contenido = src.slice(fin + 1, cierre)
    if (new RegExp(`<${tag}(?=[\\s>])`).test(contenido)) continue
    // Un interruptor (role="switch") no lleva ícono: el círculo es un <span>.
    // Sin texto ni aria-label, el lector dice «interruptor, activado» y nada más.
    const interruptorMudo = /role=["']switch["']/.test(attrs) && sinTexto(contenido)
    if (soloIconos(contenido) || interruptorMudo) out.push({ linea: src.slice(0, m.index).split('\n').length, tag })
  }
  return out
}
