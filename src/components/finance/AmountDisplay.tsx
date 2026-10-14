'use client'
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { formatMoney, currencySymbol } from '@/lib/format'
import { totalsEntries, type MoneyTotals } from '@/lib/money'

export function AmountDisplay({ amount, currency = 'CRC', defaultHidden = true, revealed: externalRevealed, restricted = true }: {
  /** null = monto restringido (solo rol finanzas lo recibe) O monto no
   *  conocido: lo decide `restricted`. */
  amount: number | null
  /** ¿A quien mira se le OCULTAN los montos? Si no —puede verlos y el monto
   *  es null— se dice «Sin monto», que es la verdad: desde el 2026-10-14 hay
   *  15.288 donaciones importadas sin monto, y pintarlas como «•••,•••» hacía
   *  creer a finanzas que había un monto escondido. Default true para no
   *  cambiar a nadie que no pase el dato. */
  restricted?: boolean
  /** INT-2: moneda de la fila (default CRC, todo lo histórico). */
  currency?: string
  defaultHidden?: boolean
  revealed?: boolean
}) {
  const [localRevealed, setLocalRevealed] = useState(!defaultHidden)
  const isRevealed = externalRevealed !== undefined ? externalRevealed : localRevealed
  const hidden = `${currencySymbol(currency)} •••,•••`

  if (amount == null) {
    if (!restricted) return <span className="text-navy-light/80">Sin monto</span>
    return <span className="inline-flex items-center gap-1">{hidden}</span>
  }

  return (
    <span className="inline-flex items-center gap-1">
      {isRevealed
        ? `${formatMoney(amount, currency)}`
        : hidden
      }
      {externalRevealed === undefined && (
        <button
          onClick={() => setLocalRevealed(r => !r)}
          title={isRevealed ? 'Ocultar' : 'Revelar'}
          aria-label={isRevealed ? 'Ocultar monto' : 'Revelar monto'}
          className="text-[#161440]/30 hover:text-[#161440]/60 transition-colors"
        >
          {isRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
      )}
    </span>
  )
}

/**
 * INT-3 · Un total que puede venir en varias monedas.
 *
 * Con una sola moneda se ve igual que siempre (una línea); con varias se apilan,
 * porque sumarlas sería inventar un tipo de cambio. Hoy todo es en colones, así
 * que en la práctica se ve una línea — esto es para cuando arranque Madrid.
 */
export function TotalsDisplay({ totals, defaultHidden = true, revealed }: {
  /** null = monto restringido (solo el rol de finanzas lo recibe). */
  totals: MoneyTotals | null
  defaultHidden?: boolean
  revealed?: boolean
}) {
  if (totals == null) {
    return <AmountDisplay amount={null} defaultHidden={defaultHidden} revealed={revealed} />
  }
  const entradas = totalsEntries(totals)
  if (entradas.length === 0) {
    return <AmountDisplay amount={0} defaultHidden={defaultHidden} revealed={revealed} />
  }
  if (entradas.length === 1) {
    const [cur, monto] = entradas[0]
    return <AmountDisplay amount={monto} currency={cur} defaultHidden={defaultHidden} revealed={revealed} />
  }
  return (
    <span className="inline-flex flex-col gap-0.5 align-top">
      {entradas.map(([cur, monto]) => (
        <AmountDisplay key={cur} amount={monto} currency={cur}
          defaultHidden={defaultHidden} revealed={revealed} />
      ))}
    </span>
  )
}
