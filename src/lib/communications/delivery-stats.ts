// Qué números mostrar en el resumen de un comunicado.
//
// El problema que resuelve (2026-07-31): la pantalla mostraba "Entregados 0 (0%)"
// y "Tasa de entrega 0%" incluso cuando los 19 correos habían salido bien. Los
// "entregados" son las confirmaciones que manda SES por SNS (evento Delivery), y
// si el configuration set no las publica, ese número es 0 para siempre. Un 0 ahí
// se lee como "no llegó ninguno", que es lo contrario de lo que pasó.
//
// Regla: si NO hay ninguna confirmación de entrega, no se inventa una tasa — se
// muestra lo que sí se sabe (cuántos salieron) y se dice que la confirmación no
// está disponible.

export type BroadcastStats = {
  total: number
  sent: number
  delivered: number
  failed: number
}

export type DeliveryCard = {
  key: 'total' | 'enviados' | 'entregados' | 'fallidos' | 'tasa'
  label: string
  value: string
  /** Nota al pie de la tarjeta (por qué no hay tasa, por ejemplo). */
  hint?: string
  tone: 'neutral' | 'good' | 'bad' | 'warn'
}

export function deliveryRate(stats: BroadcastStats): number | null {
  if (stats.total <= 0 || stats.delivered <= 0) return null
  return Math.round((stats.delivered / stats.total) * 100)
}

/** ¿Llegó alguna confirmación de entrega del proveedor para este comunicado? */
export function hasDeliveryConfirmations(stats: BroadcastStats): boolean {
  return stats.delivered > 0
}

export function deliveryCards(stats: BroadcastStats): DeliveryCard[] {
  const confirmed = hasDeliveryConfirmations(stats)
  const rate = deliveryRate(stats)

  const cards: DeliveryCard[] = [
    { key: 'total', label: 'Total destinatarios', value: String(stats.total), tone: 'neutral' },
    { key: 'enviados', label: 'Enviados', value: String(stats.sent), tone: stats.sent > 0 ? 'good' : 'neutral' },
  ]

  if (confirmed) {
    cards.push({
      key: 'entregados',
      label: 'Entregados',
      value: rate != null ? `${stats.delivered} (${rate}%)` : String(stats.delivered),
      hint: 'Confirmado por el proveedor de correo',
      tone: 'good',
    })
  }

  cards.push({
    key: 'fallidos',
    label: 'Fallidos',
    value: String(stats.failed),
    tone: stats.failed > 0 ? 'bad' : 'neutral',
  })

  cards.push(
    confirmed && rate != null
      ? {
          key: 'tasa',
          label: 'Tasa de entrega',
          value: `${rate}%`,
          tone: rate >= 90 ? 'good' : rate >= 70 ? 'warn' : 'bad',
        }
      : {
          key: 'tasa',
          label: 'Tasa de entrega',
          value: 'Sin datos',
          hint: 'El proveedor no está reportando confirmaciones de entrega',
          tone: 'neutral',
        },
  )

  return cards
}
