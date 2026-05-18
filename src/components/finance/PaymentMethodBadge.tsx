'use client'
import { CreditCard, Smartphone, GraduationCap, Banknote } from 'lucide-react'
import type { PaymentMethod } from '@/data/mock-finance'

const METHOD_CONFIG: Record<PaymentMethod, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  card:        { label: 'Tarjeta',   color: '#161440', bg: 'rgba(22,20,64,0.08)',    Icon: CreditCard    },
  sinpe:       { label: 'SINPE',     color: '#519DA2', bg: 'rgba(81,157,162,0.12)',  Icon: Smartphone    },
  scholarship: { label: 'Beca',      color: '#3DB97A', bg: 'rgba(61,185,122,0.12)', Icon: GraduationCap },
  cash:        { label: 'Efectivo',  color: '#E9B949', bg: 'rgba(233,185,73,0.15)', Icon: Banknote      },
}

export function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  const cfg = METHOD_CONFIG[method]
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      <cfg.Icon size={11} strokeWidth={2} />
      {cfg.label}
    </span>
  )
}
