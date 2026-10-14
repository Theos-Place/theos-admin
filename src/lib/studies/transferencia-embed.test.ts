/**
 * El cambio de grupo leía los pagos del origen con un embed ambiguo y, al
 * fallar en silencio, cobraba el grupo nuevo entero (Kristel Guzmán,
 * 2026-10-07). Esto fija las dos mitades del arreglo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const sin = (r: string) => readFileSync(r, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap(e => {
    const p = join(dir, e)
    return statSync(p).isDirectory() ? archivos(p) : p.endsWith('.ts') || p.endsWith('.tsx') ? [p] : []
  })
}

describe('pagos ↔ becas: el embed siempre lleva la FK', () => {
  it('el traslado nombra la FK y LEE el error', () => {
    const t = sin('src/lib/supabase/queries/transfer-enrollment.ts')
    expect(t).toContain('scholarships!payments_scholarship_id_fkey(original_amount, final_amount)')
    expect(t).toContain('if (pagosErr) {')
  })

  it('ningún embed de scholarships desde payments va sin hint en todo src', () => {
    // payments y scholarships tienen DOS FKs entre sí desde FIN-9: cualquier
    // `scholarships(` pelado en un select es un PGRST201 esperando a pasar.
    const ofensores = archivos('src')
      .filter(f => !f.endsWith('.test.ts'))
      .filter(f => /[:\s,]scholarships\(/.test(sin(f)))
    expect(ofensores).toEqual([])
  })
})
