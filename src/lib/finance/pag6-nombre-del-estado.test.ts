import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  etiquetaDeEstado, PAYMENT_STATUS_LABEL, PAYMENT_STATUS_LABEL_FINANZAS,
} from '@/lib/finance/payment-outcome'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('PAG-6 · «cancelado» significa dos cosas opuestas', () => {
  it('para FINANZAS, un cobro pagado se llama «Cancelado»', () => {
    // Es el término contable: Andrés concilia contra el estado de cuenta.
    expect(etiquetaDeEstado('paid', 'finanzas')).toBe('Cancelado')
  })

  it('y para la PERSONA sigue siendo «Pagado»', () => {
    // Decirle «Cancelado» sobre un pago suyo le haría creer que se lo anularon.
    expect(etiquetaDeEstado('paid', 'persona')).toBe('Pagado')
  })

  it('el estado que ANTES se llamaba «Cancelado» pasa a «Anulado», en los dos', () => {
    // Sin esto quedarían DOS «Cancelado» en la pantalla de conciliación y no
    // se distinguirían los 239 cobrados de los 30 anulados.
    expect(etiquetaDeEstado('cancelado', 'finanzas')).toBe('Anulado')
    expect(etiquetaDeEstado('cancelado', 'persona')).toBe('Anulado')
  })

  it('NUNCA hay dos estados con la misma etiqueta, en ninguna audiencia', () => {
    // Es la invariante del cambio: dos iguales en finanzas es exactamente el
    // problema que esto resuelve.
    for (const mapa of [PAYMENT_STATUS_LABEL, PAYMENT_STATUS_LABEL_FINANZAS]) {
      const etiquetas = Object.values(mapa)
      expect(new Set(etiquetas).size, JSON.stringify(mapa)).toBe(etiquetas.length)
    }
  })

  it('los dos mapas solo difieren en `paid`', () => {
    const distintos = (Object.keys(PAYMENT_STATUS_LABEL) as Array<keyof typeof PAYMENT_STATUS_LABEL>)
      .filter(k => PAYMENT_STATUS_LABEL[k] !== PAYMENT_STATUS_LABEL_FINANZAS[k])
    expect(distintos).toEqual(['paid'])
  })

  it('la audiencia es obligatoria: una pantalla nueva tiene que elegir', () => {
    // Sin valor por defecto, nadie hereda en silencio la de finanzas y le
    // dice «Cancelado» a un miembro.
    const src = readFileSync('src/lib/finance/payment-outcome.ts', 'utf8')
    expect(src).toMatch(/audiencia: 'finanzas' \| 'persona',\s*\)/)
    expect(src).not.toMatch(/audiencia: 'finanzas' \| 'persona' =/)
  })

  it('un estado desconocido no revienta ni inventa', () => {
    expect(etiquetaDeEstado('loquesea', 'finanzas')).toBe('loquesea')
  })
})

describe('PAG-6 · dónde se aplica cada juego', () => {
  it('el badge de finanzas usa las etiquetas de finanzas', () => {
    const src = sinComentarios('src/components/finance/PaymentStatusBadge.tsx')
    expect(src).toMatch(/etiquetaDeEstado\(status, 'finanzas'\)/)
    // Y ya no tiene las palabras escritas a mano.
    expect(src).not.toContain("label: 'Pagado'")
  })

  it('Mis pagos le sigue diciendo «Pagado» a la persona', () => {
    const src = sinComentarios('src/components/members/MemberPaymentsList.tsx')
    expect(src).toMatch(/p\.status === 'paid'\) return \{ label: 'Pagado'/)
  })

  it('el filtro de /finanzas/pagos ofrece «Cancelado» y «Anulado», no dos iguales', () => {
    const src = sinComentarios('src/app/(admin)/finanzas/pagos/page.tsx')
    expect(src).toMatch(/\{ value: 'paid', label: 'Cancelado' \}/)
    expect(src).toMatch(/\{ value: 'cancelado', label: 'Anulado' \}/)
  })

  it('y la fila de la FECHA no se llama como el estado', () => {
    // «Pagado: 3/10/2026» al lado de un badge que dice «Cancelado» confunde.
    const src = sinComentarios('src/app/(admin)/finanzas/pagos/page.tsx')
    expect(src).toContain("'Fecha de pago'")
  })

  it('el reporte de finanzas también', () => {
    const src = sinComentarios('src/app/(admin)/finanzas/reportes/page.tsx')
    expect(src).toMatch(/paid: 'Cancelado'/)
    expect(src).toMatch(/cancelado: 'Anulado'/)
  })
})
