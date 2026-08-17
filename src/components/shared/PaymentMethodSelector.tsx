'use client'
import { Smartphone, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PaymentMethodValue = 'sinpe' | 'card'

/** Selector visual de método de pago. 'sinpe' (comprobante) es el único
 *  método realmente activo hoy; 'card' (Tilopay) queda deshabilitado con
 *  badge "Próximamente" — la estructura ya soporta activarlo sin rehacer
 *  nada (solo habilitar el botón + conectar la pasarela). */
export function PaymentMethodSelector({
  value, onChange,
}: {
  value: PaymentMethodValue
  onChange: (v: PaymentMethodValue) => void
}) {
  const options: Array<{ value: PaymentMethodValue; label: string; icon: typeof Smartphone; disabled?: boolean }> = [
    { value: 'sinpe', label: 'SINPE Móvil / transferencia', icon: Smartphone },
    { value: 'card', label: 'Tarjeta de crédito/débito', icon: CreditCard, disabled: true },
  ]
  return (
    <div className="space-y-2">
      <p className="text-[12px] uppercase tracking-widest text-navy-light/70 font-display">
        Método de pago
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            disabled={o.disabled}
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative rounded-xl border px-3 py-2.5 text-left transition-colors font-body',
              value === o.value ? 'border-coral bg-coral/5' : 'border-[var(--outline-variant)]',
              o.disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            <o.icon size={16} className="mb-1 text-navy" />
            <span className="block text-[13px] text-navy">{o.label}</span>
            {o.disabled && (
              <span className="absolute top-1.5 right-1.5 rounded-full bg-surface-low px-1.5 py-0.5 text-[10px] font-display text-navy-light/70">
                Próximamente
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
