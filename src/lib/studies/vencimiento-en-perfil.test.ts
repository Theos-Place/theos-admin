/**
 * El perfil solo muestra un vencimiento que algo ejecute de verdad.
 *
 * Medido el 2026-10-14: 144 cobros de matrícula pendientes cuelgan de
 * matrículas `enrolled`, y a esas no les corre ningún reloj —el cron solo
 * suelta cupos en `pendiente_de_pago`—. Un «vence el jueves» ahí sería un
 * plazo inventado. Lo que sí se muestra: el reloj de 72h cuando el estado es
 * `pendiente_de_pago`, y el `due_date` cuando lo fijó un plan de pagos.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const src = readFileSync('src/app/(admin)/miembros/[id]/page.tsx', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('vencimiento en el perfil', () => {
  it('el reloj de 72h solo para pendiente_de_pago', () => {
    expect(src).toContain("vence: s.status === 'pendiente_de_pago' && s.reserva_desde")
  })

  it('usa el MISMO cálculo que el cron, no uno propio', () => {
    expect(src).toContain('vencimientoDeLaReserva({ enrollmentCreatedAt: s.reserva_desde')
    expect(src).not.toMatch(/72\s*\*|HORAS_DE_GRACIA\s*\*/)
  })

  it('y el due_date del plan de pagos cuando existe', () => {
    expect(src).toContain('s.cobro_vence')
  })

  it('la API expone reserva_desde y cobro_vence por matrícula', () => {
    const api = readFileSync('src/lib/supabase/queries/members-detail.ts', 'utf8')
    expect(api).toContain("reserva_desde: reservaDesdeByEnrollment.get(e.id) ?? null")
    expect(api).toContain("cobro_vence: cobroVenceByEnrollment.get(e.id) ?? null")
  })

  it('la pestaña dice «Pago pendiente» como estado, no solo el monto', () => {
    const tab = readFileSync('src/app/(admin)/miembros/[id]/_components/MemberParticipationTab.tsx', 'utf8')
    expect(tab).toContain('Pago pendiente')
    expect(tab).toContain("'Plazo vencido'")
  })
})
