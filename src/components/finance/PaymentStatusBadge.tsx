'use client'
import type { PaymentStatus } from '@/types/finance'
import { etiquetaDeEstado } from '@/lib/finance/payment-outcome'

/**
 * PAG-6 · Este badge vive SOLO en las pantallas de finanzas (verificado el
 * 2026-10-05: finanzas/page, finanzas/pagos y su detalle). Por eso usa las
 * etiquetas de finanzas, donde `paid` se escribe «Cancelado» —el término
 * contable de Andrés— y el estado `cancelado` pasa a «Anulado».
 *
 * Mis pagos NO usa este componente: tiene el suyo y le sigue diciendo
 * «Pagado» a la persona. La diferencia es a propósito; está explicada en
 * `lib/finance/payment-outcome`.
 *
 * Acá quedan solo los COLORES. Las palabras salen de un solo lugar para que
 * no haya dos verdades sobre cómo se llama un estado.
 */
const STATUS_COLOR: Record<PaymentStatus, { color: string; bg: string }> = {
  paid:           { color: '#3DB97A', bg: 'rgba(61,185,122,0.12)'  },
  pending:        { color: '#E9B949', bg: 'rgba(233,185,73,0.15)'  },
  refunded:       { color: '#3B7579', bg: 'rgba(81,157,162,0.12)'  },
  partial_refund: { color: '#70BDC2', bg: 'rgba(112,189,194,0.15)' },
  // Anulado va en gris, no en rojo: es un desenlace normal (la persona
  // canceló, se venció el plazo) y no hay nada que atender. El rojo se reserva
  // para 'failed', que sí es una avería del sistema.
  cancelado:      { color: '#29365C', bg: 'rgba(41,54,92,0.10)'    },
  failed:         { color: '#C43635', bg: 'rgba(214,62,61,0.10)'   },
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  // Fallback neutro: un estado no mapeado no debe tumbar la pantalla.
  const cfg = STATUS_COLOR[status] ?? { color: '#161440', bg: 'rgba(22,20,64,0.08)' }
  const label = etiquetaDeEstado(status, 'finanzas') || String(status || '—')
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[13px] font-medium"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {label}
    </span>
  )
}
