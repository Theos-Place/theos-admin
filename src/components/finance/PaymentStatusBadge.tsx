'use client'
import type { PaymentStatus } from '@/data/mock-finance'

const STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string; bg: string }> = {
  paid:           { label: 'Pagado',       color: '#3DB97A', bg: 'rgba(61,185,122,0.12)'  },
  pending:        { label: 'Pendiente',    color: '#E9B949', bg: 'rgba(233,185,73,0.15)'  },
  refunded:       { label: 'Devuelto',     color: '#519DA2', bg: 'rgba(81,157,162,0.12)'  },
  partial_refund: { label: 'Dev. parcial', color: '#70BDC2', bg: 'rgba(112,189,194,0.15)' },
  failed:         { label: 'Fallido',      color: '#EF5554', bg: 'rgba(239,85,84,0.10)'   },
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {cfg.label}
    </span>
  )
}
