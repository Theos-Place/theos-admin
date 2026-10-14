/**
 * «Sin monto» no es «monto oculto» (2026-10-14).
 *
 * Al pasar 15.135 montos en cero a null, el listado de donaciones empezó a
 * pintar esas filas como «₡ •••,•••» —el dibujo de «restringido»— también
 * para finanzas, que sí puede ver montos. El servidor ahora dice si los
 * montos son visibles para quien pregunta, y el componente distingue.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
const sin = (r: string) => readFileSync(r, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('monto desconocido vs. monto restringido', () => {
  it('la API dice si los montos son visibles', () => {
    expect(sin('src/app/api/finance/donations/route.ts')).toContain('amounts_visible: !stripAmounts')
  })

  it('el componente pinta «Sin monto» cuando no está restringido', () => {
    const c = sin('src/components/finance/AmountDisplay.tsx')
    expect(c).toContain("if (!restricted) return <span className=\"text-navy-light/80\">Sin monto</span>")
    // y por defecto sigue ocultando, para quien no pase el dato
    expect(c).toContain('restricted = true')
  })

  it('el listado pasa la bandera a cada fila', () => {
    // La bandera viene con la lista (mismo fetch): si se guardara aparte, al
    // cambiar de filtro podría quedar la bandera vieja junto a la lista nueva.
    expect(sin('src/hooks/useDonations.ts')).toContain("amountsVisible: d.amounts_visible === true")
    const p = sin('src/app/(admin)/finanzas/donaciones/page.tsx')
    expect(p).toMatch(/const \{[^}]*amountsVisible[^}]*\} =\s*useDonations\(/)
    expect((p.match(/restricted=\{!amountsVisible\}/g) ?? []).length).toBeGreaterThanOrEqual(3)
  })
})
