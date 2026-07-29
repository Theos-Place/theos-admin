// Etiqueta de costo de un plan de estudio. Decisión 2026-07-29: Discípulos 2
// y 3 no son "gratis" — su costo está INCLUIDO en el pago de Discípulos 1
// (la capacitación se cobra una vez al inicio de la cadena DIS1→DIS3).
import { formatCRC } from '@/lib/format'

const INCLUDED_IN_DIS1 = new Set(['DIS2', 'DIS3'])

export function studyCostLabel(code: string | null | undefined, cost: number | null | undefined): string {
  const c = Number(cost ?? 0)
  if (c > 0) return formatCRC(c)
  if (code && INCLUDED_IN_DIS1.has(code)) return 'Incluido en el costo de Discípulos 1'
  return 'Gratis'
}
