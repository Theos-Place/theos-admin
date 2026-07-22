'use client'
import { CreditCard, Smartphone, GraduationCap, Banknote, Receipt } from 'lucide-react'
import type { PaymentMethod } from '@/types/finance'

const METHOD_CONFIG: Record<PaymentMethod, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  card:        { label: 'Tarjeta',     color: '#161440', bg: 'rgba(22,20,64,0.08)',    Icon: CreditCard    },
  sinpe:       { label: 'SINPE',       color: '#519DA2', bg: 'rgba(81,157,162,0.12)',  Icon: Smartphone    },
  scholarship: { label: 'Beca',        color: '#3DB97A', bg: 'rgba(61,185,122,0.12)', Icon: GraduationCap },
  cash:        { label: 'Efectivo',    color: '#E9B949', bg: 'rgba(233,185,73,0.15)', Icon: Banknote      },
  comprobante: { label: 'Comprobante', color: '#519DA2', bg: 'rgba(81,157,162,0.12)', Icon: Receipt       },
}

// Fallback neutro: un método no mapeado NO debe tumbar la pantalla; muestra su
// valor crudo. (El crash de junio-2026 fue por 'comprobante' sin entrada.)
const FALLBACK = { label: '', color: '#161440', bg: 'rgba(22,20,64,0.08)', Icon: CreditCard }

export function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  const cfg = METHOD_CONFIG[method] ?? { ...FALLBACK, label: String(method || '—') }
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
