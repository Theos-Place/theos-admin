import { cn } from '@/lib/utils'
import { inputCls, Toggle, FieldLabel } from './shared'
import { CURRENCIES, currencySymbol } from '@/lib/format'

interface Step4Props {
  requires_payment: boolean
  payment_amount: string
  currency: string
  server_price: string
  servers_pay: boolean
  onTogglePayment: () => void
  onPaymentAmountChange: (v: string) => void
  onCurrencyChange: (v: string) => void
  onServerPriceChange: (v: string) => void
  onToggleServersPay: () => void
}

export function Step4Financiero({
  requires_payment,
  payment_amount,
  currency,
  server_price,
  servers_pay,
  onTogglePayment,
  onPaymentAmountChange,
  onCurrencyChange,
  onServerPriceChange,
  onToggleServersPay,
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
            <div className="space-y-4 pl-1">
              {/* INT-2: moneda del cobro (los pagos del evento la heredan). */}
              <div className="max-w-[160px]">
                <FieldLabel>Moneda</FieldLabel>
                <select className={cn(inputCls, 'font-body')} value={currency} onChange={e => onCurrencyChange(e.target.value)} aria-label="Moneda del cobro">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Costo</FieldLabel>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-navy-light/60 font-mono">{currencySymbol(currency)}</span>
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
                  <FieldLabel>Costo para servidores (opcional)</FieldLabel>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-navy-light/60 font-mono">{currencySymbol(currency)}</span>
                    <input
                      type="number"
                      className={cn(inputCls, 'pl-7', 'font-body')}
                      placeholder="Igual al costo"
                      value={server_price}
                      onChange={e => onServerPriceChange(e.target.value)}
                      disabled={!servers_pay}
                    />
                  </div>
                  <p className="text-[11px] text-navy-light/60 mt-1 font-body">
                    Se aplica a servidores activos de los comités organizadores.
                  </p>
                </div>
              </div>
              <Toggle
                checked={!servers_pay}
                onToggle={onToggleServersPay}
                label="Servidores exentos de pago"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
