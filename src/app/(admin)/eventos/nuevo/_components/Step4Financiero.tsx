import { cn } from '@/lib/utils'
import { inputCls, Toggle, FieldLabel } from './shared'
import { CURRENCIES, currencySymbol, amountStep } from '@/lib/format'
import { useSedes } from '@/lib/sedes'

interface Step4Props {
  /** INT-3: la sede propone la moneda del cobro (Madrid en euros). */
  sede_id: string | null
  onSedeChange: (sedeId: string | null, currency: string) => void
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
  sede_id,
  onSedeChange,
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
  const { activeSedes } = useSedes()
  const sede = activeSedes.find(x => x.sede_id === sede_id)
  // Aviso, no bloqueo: la moneda es editable a propósito (un evento de Madrid
  // podría cobrarse en colones si así se decidió).
  const desajuste = !!sede && (sede.currency ?? 'CRC') !== currency

  return (
    <div className="space-y-4">
      {/* Pago */}
      <div className="card py-5 px-6 w-full">
        <div className="card-title mb-4">Financiero</div>
        <div className="space-y-4">
          <div className="max-w-[280px]">
            <FieldLabel>Sede</FieldLabel>
            <select
              className={cn(inputCls, 'font-body')}
              value={sede_id ?? ''}
              aria-label="Sede del evento"
              onChange={e => {
                const id = e.target.value || null
                const s = activeSedes.find(x => x.sede_id === id)
                onSedeChange(id, s?.currency ?? 'CRC')
              }}
            >
              <option value="">Sin sede</option>
              {activeSedes.map(s => <option key={s.sede_id ?? s.id} value={s.sede_id ?? ''}>{s.name}</option>)}
            </select>
            <p className="text-[11px] text-navy-light/60 mt-1 font-body">
              Propone la moneda del cobro. Se puede cambiar abajo.
            </p>
          </div>

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
              {desajuste && (
                <p className="text-[12px] text-coral font-body">
                  {sede?.name} cobra normalmente en {sede?.currency}. Revisá que la moneda sea la correcta.
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Costo</FieldLabel>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-navy-light/60 font-mono">{currencySymbol(currency)}</span>
                    <input
                      type="number"
                      step={amountStep(currency)}
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
                      step={amountStep(currency)}
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
