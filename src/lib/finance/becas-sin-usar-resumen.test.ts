/**
 * El resumen de finanzas decía «9 becas sin usar» y eran 2 (2026-10-14):
 * contaba todo lo `active` de la tabla scholarships, incluidos los créditos
 * por congelar (FIN-9) y los cupones genéricos.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('becas sin usar en el resumen', () => {
  it('cuenta solo las asignadas sin aplicar, con la regla de la pestaña de becas', () => {
    const s = readFileSync('src/app/(admin)/finanzas/page.tsx', 'utf8')
    expect(s).toContain("s.kind === 'asignada' && usoDeLaBeca(s) === 'sin_usar'")
    expect(s).not.toContain("scholarships.filter(s => s.status === 'active').length")
  })
})
