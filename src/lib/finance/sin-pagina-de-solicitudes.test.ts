/**
 * /finanzas/solicitudes se eliminó (Floriana, 2026-10-14).
 *
 * Medido antes de borrarla: 10 solicitudes en toda la historia, todas de beca
 * y resueltas, y /finanzas/becas ya cubre ese ciclo. Cero devoluciones por
 * esa vía, y devoluciones corre sobre `refunds`, no sobre finance_requests.
 * Este test fija los tres cabos que había que atar.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
const sin = (r: string) => readFileSync(r, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('sin página de solicitudes financieras', () => {
  it('la página y su entrada del menú ya no existen', () => {
    expect(existsSync('src/app/(admin)/finanzas/solicitudes')).toBe(false)
    const sb = sin('src/components/layout/Sidebar.tsx')
    expect(sb).not.toContain('/finanzas/solicitudes')
    expect(sb).not.toContain('openFinanceRequests')
  })

  it('las notificaciones de beca llevan a /finanzas/becas, que abre la solicitud', () => {
    expect(sin('src/lib/supabase/queries/finance-requests.ts')).not.toContain('/finanzas/solicitudes')
    expect(sin('src/lib/supabase/queries/finance-requests.ts').match(/\/finanzas\/becas\?request=/g)?.length).toBe(2)
    expect(sin('src/app/(admin)/finanzas/becas/page.tsx')).toContain("new URLSearchParams(useUbicacionDeEntrada().search).get('request')")
  })

  it('la cancelación prematrimonial crea una devolución REAL, no una solicitud huérfana', () => {
    const src = sin('src/lib/supabase/queries/prematrimonial.ts')
    expect(src).toContain("createRefund({")
    expect(src).not.toContain("request_type: 'refund'")
  })

  it('la API de solicitudes solo acepta becas', () => {
    expect(sin('src/app/api/finance/requests/route.ts')).toContain("const TYPES = new Set(['scholarship'])")
  })
})
