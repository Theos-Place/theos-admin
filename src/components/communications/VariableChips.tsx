'use client'

import { cn } from '@/lib/utils'

export const AVAILABLE_VARIABLES = [
  { key: '{nombre}',     label: 'nombre',     description: 'Nombre del destinatario' },
  { key: '{sede}',       label: 'sede',       description: 'Sede principal del miembro' },
  { key: '{evento}',     label: 'evento',     description: 'Nombre del evento' },
  { key: '{fecha}',      label: 'fecha',      description: 'Fecha del evento' },
  { key: '{hora}',       label: 'hora',       description: 'Hora del evento' },
  { key: '{ubicacion}',  label: 'ubicación',  description: 'Dirección del evento' },
  { key: '{smart_link}', label: 'smart_link', description: 'Link de acceso al perfil' },
  { key: '{motivo}',     label: 'motivo',     description: 'Motivo (para cancelaciones)' },
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
      <p className="text-[10px] uppercase tracking-widests text-navy-light/40 font-display">
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
              'rounded-full border px-2.5 py-1 text-[11px] font-mono text-navy-light transition-all',
              'hover:bg-navy hover:text-white hover:border-navy active:scale-95'
            )}
            style={{ borderColor: 'var(--outline-variant)' }}
          >
            {v.key}
          </button>
        ))}
      </div>
    </div>
  )
}
