import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * LINT-1 · `usePrecarga` ajusta estado DURANTE el render. Eso es válido —es
 * el patrón que React documenta para derivar de props— pero solo mientras se
 * use para lo que es: volcar datos cargados a los `useState` de un
 * formulario.
 *
 * Si alguien lo usa para pedir datos, enfocar un input o medir el DOM, eso
 * SÍ es un efecto y meterlo acá lo haría correr en render, que es un bug de
 * verdad y no un aviso de lint.
 */
function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return archivos(p)
    return /\.tsx?$/.test(n) && !n.endsWith('.test.ts') && !n.endsWith('.test.tsx') ? [p] : []
  })
}

const usos = archivos(join(process.cwd(), 'src'))
  .map(p => [p, readFileSync(p, 'utf8')] as const)
  .filter(([p, s]) => s.includes('usePrecarga(') && !p.endsWith('usePrecarga.ts'))

describe('LINT-1 · usePrecarga se usa solo para volcar', () => {
  it('hay usos, o este test no vigila nada', () => {
    expect(usos.length).toBeGreaterThan(0)
  })

  it('ninguno pide datos ni toca el DOM dentro del vuelco', () => {
    const prohibido = /usePrecarga\([^)]*,\s*\(\)\s*=>\s*\{[\s\S]{0,1200}?\n\s{2}\}\)/g
    for (const [ruta, s] of usos) {
      for (const bloque of s.match(prohibido) ?? []) {
        for (const mal of ['fetch(', 'document.', 'scrollIntoView', '.focus(', 'setTimeout(', 'await ']) {
          expect(bloque.includes(mal), `${ruta.split('/src/')[1]} usa ${mal} dentro de usePrecarga`)
            .toBe(false)
        }
      }
    }
  })

  it('la clave es un string o undefined, nunca un objeto', () => {
    // Un objeto cambia de identidad en cada render y el vuelco se repetiría
    // sin parar, pisando lo que la persona escribe. Es el mismo cuidado que
    // la clave de `useCargaRemota`.
    for (const [ruta, s] of usos) {
      for (const m of s.matchAll(/usePrecarga\(([^,]+),/g)) {
        const clave = m[1].trim()
        expect(clave.startsWith('{') || clave.startsWith('['),
          `${ruta.split('/src/')[1]}: la clave ${clave} no es estable`).toBe(false)
      }
    }
  })
})
