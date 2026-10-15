import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// 2026-10-15 · Lo que axe seguía marcando después de los tokens: chips de color
// pintados sobre la cabecera navy, y un color de tipo que elige un admin.

const leer = (p: string) => readFileSync(p, 'utf8')

describe('chips sobre la cabecera navy', () => {
  it('el tipo de evento calcula su letra sobre blanco y va blanca sobre navy', () => {
    const badge = leer('src/components/events/EventTypeBadge.tsx')
    expect(badge).toMatch(/tone === 'dark' \? '#FFFFFF' : textoSobreSuTinte\(color, 0\)/)
    expect(leer('src/app/(admin)/eventos/[id]/_components/EventHeader.tsx')).toMatch(/<EventTypeBadge[^>]*tone="dark"/)
  })
  it('estado y método del pago van sobre blanco pleno en la cabecera del detalle', () => {
    for (const p of ['src/components/finance/PaymentStatusBadge.tsx', 'src/components/finance/PaymentMethodBadge.tsx']) {
      expect(leer(p)).toMatch(/background: tone === 'dark' \? '#FFFFFF' : cfg\.bg/)
    }
    const detalle = leer('src/app/(admin)/finanzas/pagos/[id]/page.tsx')
    expect(detalle).toMatch(/<PaymentMethodBadge[^>]*tone="dark"/)
    expect(detalle).toMatch(/<PaymentStatusBadge[^>]*tone="dark"/)
  })
})

describe('atenuar no es lo mismo que deshabilitar', () => {
  it('los planes archivados no se atenúan con opacidad (bajaba el texto a 2.3)', () => {
    expect(leer('src/app/(admin)/estudios/plan/page.tsx')).not.toMatch(/is_archived \? \{ opacity|opacity: study\.is_archived/)
  })
  it('un paso futuro del wizard de eventos es un botón deshabilitado, no solo gris', () => {
    expect(leer('src/app/(admin)/eventos/nuevo/_components/StepSidebar.tsx')).toMatch(/disabled=\{!\(done \|\| active\)\}/)
  })
})
