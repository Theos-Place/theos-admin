import { cn } from '@/lib/utils'
import { inputCls, Toggle, FieldLabel } from './shared'

interface Step4Props {
  requires_payment: boolean
  payment_amount: string
  payment_methods: string[]
  onTogglePayment: () => void
  onPaymentAmountChange: (v: string) => void
  onTogglePaymentMethod: (m: string) => void
}

export function Step4Financiero({
  requires_payment,
  payment_amount,
  payment_methods,
  onTogglePayment,
  onPaymentAmountChange,
  onTogglePaymentMethod,
}: Step4Props) {
  return (
    <div className="space-y-4">
      {/* Pago */}
      <div className="card py-5 px-6 w-full">
        <div className="card-title mb-4">Financiero</div>
        <div className="space-y-4">
          <Toggle
            checked={requires_payment}
            onToggle={onTogglePayment}
            label="Evento con cobro"
          />
          {requires_payment && (
            <div className="space-y-3 pl-14">
              <div className="form-row">
                <div>
                  <FieldLabel>Monto</FieldLabel>
                  <div className="relative">
                    <span
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-navy-light/60 font-mono"
                    >
                      ₡
                    </span>
                    <input
                      type="number"
                      className={cn(inputCls, 'pl-7', 'font-body')}
                      placeholder="15000"
                      value={payment_amount}
                      onChange={e => onPaymentAmountChange(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel>Métodos de pago</FieldLabel>
                  <div className="flex flex-wrap gap-4 pt-2">
                    {['Tarjeta', 'SINPE Móvil'].map(m => (
                      <label key={m} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="accent-coral"
                          checked={payment_methods.includes(m)}
                          onChange={() => onTogglePaymentMethod(m)}
                        />
                        <span
                          className="text-sm text-navy font-body"
                        >
                          {m}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
