'use client'
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export function AmountDisplay({ amount, defaultHidden = true, revealed: externalRevealed }: {
  /** null = monto restringido (solo rol finanzas lo recibe): oculto sin toggle. */
  amount: number | null
  defaultHidden?: boolean
  revealed?: boolean
}) {
  const [localRevealed, setLocalRevealed] = useState(!defaultHidden)
  const isRevealed = externalRevealed !== undefined ? externalRevealed : localRevealed

  if (amount == null) {
    return <span className="inline-flex items-center gap-1">₡ •••,•••</span>
  }

  return (
    <span className="inline-flex items-center gap-1">
      {isRevealed
        ? `₡${amount.toLocaleString('es-CR')}`
        : '₡ •••,•••'
      }
      {externalRevealed === undefined && (
        <button
          onClick={() => setLocalRevealed(r => !r)}
          title={isRevealed ? 'Ocultar' : 'Revelar'}
          className="text-[#161440]/30 hover:text-[#161440]/60 transition-colors"
        >
          {isRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
      )}
    </span>
  )
}
