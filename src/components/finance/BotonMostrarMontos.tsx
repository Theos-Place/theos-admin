'use client'

import { Eye, EyeOff } from 'lucide-react'
import { BOTON_SECUNDARIO } from '@/components/finance/reporte-ui'

/**
 * El «Mostrar montos» de los reportes de finanzas. Uno solo, para que las
 * tres pestañas se vean y se comporten igual y siempre esté en el mismo lugar:
 * a la derecha, junto a Exportar (pedido de Floriana, 2026-10-14: «para que el
 * usuario se familiarice»).
 */
export function BotonMostrarMontos({ visibles, onCambio }: { visibles: boolean; onCambio: () => void }) {
  return (
    <button type="button" onClick={onCambio} aria-pressed={visibles}
      className={BOTON_SECUNDARIO}>
      {visibles ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
      {visibles ? 'Ocultar montos' : 'Mostrar montos'}
    </button>
  )
}
