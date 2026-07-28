'use client'
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { formatMoney, currencySymbol } from '@/lib/format'

export function AmountDisplay({ amount, currency = 'CRC', defaultHidden = true, revealed: externalRevealed }: {
  /** null = monto restringido (solo rol finanzas lo recibe): oculto sin toggle. */
  amount: number | null
  /** INT-2: moneda de la fila (default CRC, todo lo histórico). */
  currency?: string
  defaultHidden?: boolean
  revealed?: boolean
}) {
  const [localRevealed, setLocalRevealed] = useState(!defaultHidden)
  const isRevealed = externalRevealed !== undefined ? externalRevealed : localRevealed
  const hidden = `${currencySymbol(currency)} •••,•••`

  if (amount == null) {
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
