import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { focoInvisible } from './foco-invisible'

describe('focoInvisible', () => {
  it('marca un campo que quita el contorno y no pone otro', () => {
    expect(focoInvisible(`<input className="rounded-xl border px-3 outline-none" />`)).toHaveLength(1)
  })
  it('no marca si pone un anillo de foco', () => {
    expect(focoInvisible(`<input className="rounded-xl border outline-none focus:ring-1 focus:ring-coral/30" />`)).toHaveLength(0)
  })
  it('lee el cn() completo, aunque el focus: esté en otra línea', () => {
    expect(focoInvisible(`<input className={cn(\n  'w-full outline-none',\n  'focus:ring-2 focus:ring-navy/10',\n)} />`)).toHaveLength(0)
  })
  it('lee la constante cuando el className es un identificador', () => {
    expect(focoInvisible(`const INPUT = [\n  'outline-none',\n  'focus:ring-2',\n].join(' ')\n\nfunction X() { return <input className={INPUT} /> }`)).toHaveLength(0)
  })
  it('un campo transparente adentro de una caja con focus-within está bien', () => {
    expect(focoInvisible(`<div className="rounded-xl border focus-within:ring-1">\n  <Search />\n  <input className="flex-1 bg-transparent outline-none" />\n</div>`)).toHaveLength(0)
  })
})

// QA-2/M6 (2026-10-15) · El barrido sobre TODO el código: eran 38 (las fechas
// de RequestBoard, que el recorrido de teclado confirmó, entre ellos). Quedó
// en cero. Un campo nuevo con outline-none y sin foco rompe esto.
describe('el código entero', () => {
  it('ningún elemento quita el foco sin poner otro', () => {
    const archivos = execSync('git ls-files "src/**/*.tsx"', { encoding: 'utf8' }).split('\n').filter(Boolean)
    const hallados = archivos.flatMap(f => focoInvisible(readFileSync(f, 'utf8')).map(x => `${f}:${x.linea}`))
    expect(hallados).toEqual([])
  })
})
