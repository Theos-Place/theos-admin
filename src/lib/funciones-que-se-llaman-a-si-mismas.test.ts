import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 2026-10-15 · En el refactor LINT-1, un reemplazo de `setOpen(true)` por
 * `abrir()` cayó también DENTRO de `abrir`, que quedó llamándose a sí misma.
 * Al enfocar el buscador de dirigentes reventaba la pila y la lista no abría:
 * no se podía poner dirigente ni co-dirigente a un grupo. Ni tsc ni eslint lo
 * ven, y pasó a producción.
 *
 * Esto barre `src` buscando una función cuya PRIMERA instrucción es llamarse a
 * sí misma: eso nunca es recursión con intención (no hay caso base antes).
 */
function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap(f => {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) return f === 'node_modules' ? [] : archivos(p)
    return /\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p) ? [p] : []
  })
}

describe('ninguna función empieza llamándose a sí misma', () => {
  it('en todo src', () => {
    const hallazgos: string[] = []
    for (const p of archivos('src')) {
      const s = readFileSync(p, 'utf8')
      const re = /function (\w+)\s*\([^)]*\)\s*(?::[^{]+)?\{\s*(?:\/\/[^\n]*\n\s*)*\1\s*\(/g
      let m
      while ((m = re.exec(s))) hallazgos.push(`${p}: ${m[1]}`)
    }
    expect(hallazgos).toEqual([])
  })

  it('y el buscador de dirigentes abre de verdad', () => {
    const s = readFileSync('src/components/shared/DirigentesCombobox.tsx', 'utf8')
    const i = s.indexOf('function abrir()')
    expect(s.slice(i, s.indexOf('}', i))).toContain('setOpen(true)')
  })
})
