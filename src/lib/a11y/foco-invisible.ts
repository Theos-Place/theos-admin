/**
 * QA-2/M6 · Elementos que quitan el contorno de foco y no ponen otro
 * (2026-10-15). Con teclado, el foco desaparece: no se sabe dónde se está.
 *
 * Se revisa el atributo `className` COMPLETO de cada elemento (string,
 * template o `cn(...)`), no línea por línea: muchas clases vienen partidas y el
 * `focus:` está en otra línea del mismo `cn()`. También se revisa la constante
 * de clases cuando el className es solo un identificador (`className={INPUT}`).
 *
 * Un campo transparente adentro de una caja que se marca con `focus-within:`
 * está bien: el foco se ve en la caja. Se busca ese contenedor en las 20 líneas
 * de arriba; es heurística, como los otros barridos de esta carpeta.
 *
 * Módulo PURO.
 */
export type FocoInvisible = { linea: number }

/** El valor del className que empieza en `i` (después de `className=`). */
function valorDeClassName(src: string, i: number): string {
  const c = src[i]
  if (c === '"' || c === "'") return src.slice(i + 1, src.indexOf(c, i + 1))
  if (c !== '{') return ''
  let llaves = 0
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') llaves++
    else if (src[j] === '}' && --llaves === 0) return src.slice(i + 1, j)
  }
  return ''
}

const TIENE_FOCO = /focus(-visible|-within)?:/

export function focoInvisible(src: string): FocoInvisible[] {
  const out: FocoInvisible[] = []
  const lineas = src.split('\n')
  for (const m of src.matchAll(/className=/g)) {
    let valor = valorDeClassName(src, m.index! + m[0].length)
    // className={INPUT}: mirar la constante
    const id = valor.trim().match(/^([A-Z_][A-Z0-9_]*)$/)
    if (id) {
      const def = src.match(new RegExp(`const ${id[1]}\\s*=\\s*([\\s\\S]*?)\\n(?:const|export|function|\\n)`))
      valor = def ? def[1] : valor
    }
    if (!/(^|[\s'"`])outline-none(?![\w-])/.test(valor) || TIENE_FOCO.test(valor)) continue
    const linea = src.slice(0, m.index).split('\n').length
    const arriba = lineas.slice(Math.max(0, linea - 21), linea - 1).join('\n')
    if (/bg-transparent/.test(valor) && /focus-within:/.test(arriba)) continue
    out.push({ linea })
  }
  return out
}
