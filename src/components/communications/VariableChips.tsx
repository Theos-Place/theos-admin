'use client'

import { cn } from '@/lib/utils'

// Por ahora una sola variable: {nombre} → nombre del destinatario. Se reemplaza
// al enviar (email/whatsapp) y al crear la notificación interna.
export const AVAILABLE_VARIABLES = [
  { key: '{nombre}', label: 'nombre', description: 'Nombre del destinatario' },
]

interface Props {
  onInsert: (variable: string) => void
  available?: string[]
}

export function VariableChips({ onInsert, available }: Props) {
  const vars = available
    ? AVAILABLE_VARIABLES.filter(v => available.includes(v.key))
    : AVAILABLE_VARIABLES

  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display">
        Variables disponibles
      </p>
      <div className="flex flex-wrap gap-1.5">
        {vars.map(v => (
          <button
            key={v.key}
            type="button"
            title={v.description}
            onClick={() => onInsert(v.key)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[13px] font-mono text-navy-light transition-all',
              'hover:bg-navy hover:text-white hover:border-navy active:scale-95'
            , 'border-outline')}
          >
            {v.key}
          </button>
        ))}
      </div>
    </div>
  )
}
