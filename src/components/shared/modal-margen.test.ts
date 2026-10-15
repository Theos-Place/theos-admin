import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

/**
 * 2026-10-15 · El modal compartido NO pone margen interno: cada pantalla lo
 * pone. Cinco no lo ponían y el texto quedaba pegado al borde (la evaluación
 * del cierre de prematrimonial, entre otras).
 *
 * Regla: el primer elemento dentro de <Modal> lleva padding, o es un contenedor
 * cuyo primer hijo lo lleva (las cabeceras con borde), o es un componente
 * propio (que trae el suyo).
 */
function finDeApertura(s: string, i: number): number {
  let llaves = 0
  let comilla: string | null = null
  for (let j = i; j < s.length; j++) {
    const c = s[j]
    if (comilla) { if (c === comilla) comilla = null; continue }
    if (c === '"' || c === "'" || c === '`') { comilla = c; continue }
    if (c === '{') llaves++
    else if (c === '}') llaves--
    else if (c === '>' && llaves === 0) return j
  }
  return -1
}
const PADDING = /\b(p|px|py|pt)-(\d|\[)/

function primerElemento(s: string): { tag: string; attrs: string; resto: string } | null {
  const r = s.replace(/^\s*(\{\/\*[\s\S]*?\*\/\}\s*)*/, '')
  const t = r.match(/^<([A-Za-z0-9.]+)/)
  if (!t) return null
  const fin = finDeApertura(r, t[0].length)
  return { tag: t[1], attrs: r.slice(t[0].length, fin), resto: r.slice(fin + 1) }
}

function modalesSinMargen(src: string): number[] {
  const out: number[] = []
  for (const m of src.matchAll(/<Modal(?=[\s>])/g)) {
    const fin = finDeApertura(src, m.index! + 6)
    const uno = primerElemento(src.slice(fin + 1))
    if (!uno || /^[A-Z]/.test(uno.tag) || PADDING.test(uno.attrs)) continue
    const dos = primerElemento(uno.resto)
    if (dos && (PADDING.test(dos.attrs) || /^[A-Z]/.test(dos.tag))) continue
    out.push(src.slice(0, m.index).split('\n').length)
  }
  return out
}

describe('todo <Modal> tiene margen interno', () => {
  it('detecta el caso de la evaluación', () => {
    expect(modalesSinMargen(`<Modal onClose={() => x()}>\n<h2 className="text-lg">Hola</h2></Modal>`)).toEqual([1])
    expect(modalesSinMargen(`<Modal onClose={() => x()}><div className="p-6"><h2 /></div></Modal>`)).toEqual([])
    expect(modalesSinMargen(`<Modal onClose={c}><div><div className="px-5 py-4 border-b" /></div></Modal>`)).toEqual([])
  })
  it('en todo el código', () => {
    const archivos = execSync('git ls-files "src/**/*.tsx"', { encoding: 'utf8' }).split('\n').filter(Boolean)
    const hallados = archivos.flatMap(f => modalesSinMargen(readFileSync(f, 'utf8')).map(l => `${f}:${l}`))
    expect(hallados).toEqual([])
  })
})
