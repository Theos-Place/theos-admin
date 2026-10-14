import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('menú de Finanzas', () => {
  it('va en orden alfabético (Resumen se pinta aparte, primero)', () => {
    const s = readFileSync('src/components/layout/Sidebar.tsx', 'utf8')
    const bloque = s.slice(s.indexOf('const finanzasSub: SubItem[] = ['))
    expect(bloque.slice(0, bloque.indexOf('// Mantenimiento'))).toContain(".sort((a, b) => a.label.localeCompare(b.label, 'es'))")
  })
})
