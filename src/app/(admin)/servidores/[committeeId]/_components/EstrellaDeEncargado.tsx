'use client'

import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  nombre: string
  encargado: boolean
  /** Sin permiso la estrella es solo indicador: se ve, no se toca. */
  puedeEditar: boolean
  guardando?: boolean
  onToggle: () => void
}

/**
 * La estrella de encargado del comité (SRV-5).
 *
 * Rellena = a cargo. Quien no administra comités la ve igual pero no la puede
 * tocar, y ahí ni siquiera es un botón: un botón deshabilitado invita a
 * clickearlo y no dice nada.
 */
export function EstrellaDeEncargado({ nombre, encargado, puedeEditar, guardando, onToggle }: Props) {
  const clase = cn('shrink-0 transition-colors', encargado ? 'text-coral' : 'text-navy-light/40')

  if (!puedeEditar) {
    return encargado
      ? <Star size={14} className={clase} fill="currentColor" aria-label={`${nombre} es encargada del comité`} />
      : null
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={guardando}
      title={encargado ? 'Encargado del comité' : 'Marcar como encargado del comité'}
      aria-pressed={encargado}
      aria-label={encargado ? `Quitar a ${nombre} como encargado del comité` : `Marcar a ${nombre} como encargado del comité`}
      className={cn(
        clase,
        'rounded p-0.5 bg-transparent border-0 cursor-pointer hover:text-coral disabled:opacity-50',
      )}
    >
      <Star size={14} fill={encargado ? 'currentColor' : 'none'} />
    </button>
  )
}
