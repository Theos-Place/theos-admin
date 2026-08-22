// AUD-1 · Un <label> pegado a un input nativo tiene que estar ASOCIADO.
//
// Es un test de CÓDIGO, no de cálculo: la regla es "esta forma no debe existir".
// Sin asociación el input no tiene nombre accesible y el lector de pantalla
// anuncia "cuadro de edición" y nada más — el placeholder no cuenta, desaparece
// al escribir. Es WCAG 1.3.1 y 4.1.2, nivel A.
//
// Se cerraron 175 casos el 2026-08-21 (143 sin ningún nombre accesible + 32 que
// tenían aria-label y ahora además tienen la asociación). Esto evita que vuelvan.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

/** Reemplaza los comentarios por espacios del mismo largo (offsets intactos).
 *  Hace falta: un comentario puede contener el texto literal `<label>` —pasa en
 *  FormFiller.tsx— y sin enmascararlo la regex lo lee como etiqueta real. */
function sinComentarios(txt: string): string {
  const out = txt.split('')
  for (const m of txt.matchAll(/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\//g)) {
    for (let i = m.index!; i < m.index! + m[0].length; i++) {
      if (out[i] !== '\n') out[i] = ' '
    }
  }
  return out.join('')
}

describe('asociación de labels', () => {
  const archivos = execSync("grep -rl '<label' src --include='*.tsx'", { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean)

  it('ningún <label> queda pegado a un input nativo sin asociar', () => {
    const huerfanos: string[] = []
    for (const f of archivos) {
      const txt = sinComentarios(readFileSync(f, 'utf8'))
      for (const m of txt.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/g)) {
        const [, attrs, inner] = m
        // Con htmlFor está asociado; envolviendo su input, también.
        if (attrs.includes('htmlFor')) continue
        if (/<input|<select|<textarea/.test(inner)) continue
        // ¿lo que sigue es un input NATIVO adyacente?
        const despues = txt.slice(m.index! + m[0].length)
        const sig = /<(input|select|textarea)\b/.exec(despues)
        if (!sig) continue
        const entre = despues.slice(0, sig.index)
        if (!/^\s*(?:<(?:div|span)\b[^>]*>\s*)?$/.test(entre)) continue
        huerfanos.push(`${f}:${txt.slice(0, m.index!).split('\n').length}`)
      }
    }
    expect(huerfanos).toEqual([])
  })

  // Los ids generados tienen que ser únicos DENTRO de su archivo: dos inputs con
  // el mismo id hacen que el label apunte al primero y el segundo quede anónimo.
  it('no hay ids duplicados en un mismo archivo', () => {
    const choques: string[] = []
    for (const f of archivos) {
      const ids = [...readFileSync(f, 'utf8').matchAll(/\bid="([^"{}]+)"/g)].map(m => m[1])
      const vistos = new Set<string>()
      for (const id of ids) {
        if (vistos.has(id)) choques.push(`${f} → ${id}`)
        vistos.add(id)
      }
    }
    expect(choques).toEqual([])
  })
})
