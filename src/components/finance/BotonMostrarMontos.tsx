'use client'

import { Eye, EyeOff } from 'lucide-react'

/**
 * El «Mostrar montos» de los reportes de finanzas. Uno solo, para que las
 * tres pestañas se vean y se comporten igual y siempre esté en el mismo lugar:
 * a la derecha, junto a Exportar (pedido de Floriana, 2026-10-14: «para que el
 * usuario se familiarice»).
 */
export function BotonMostrarMontos({ visibles, onCambio }: { visibles: boolean; onCambio: () => void }) {
  return (
    <button type="button" onClick={onCambio} aria-pressed={visibles}
      className="inline-flex items-center gap-2 rounded-full border border-navy/20 px-3 py-2 text-[13px] text-navy hover:bg-navy/5 transition-colors shrink-0 font-body">
      {visibles ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
      {visibles ? 'Ocultar montos' : 'Mostrar montos'}
    </button>
  )
}
