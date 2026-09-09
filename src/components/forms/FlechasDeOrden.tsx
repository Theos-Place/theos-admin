'use client'

import { ChevronUp, ChevronDown } from 'lucide-react'
import { puedeSubir, puedeBajar } from '@/lib/forms/reordenar'

/**
 * Par de flechas para subir/bajar un elemento de una lista del editor.
 *
 * No son un duplicado del arrastre: el drag de HTML5 no existe en táctil, así
 * que desde el celular son la ÚNICA forma de reordenar. Por eso van siempre
 * visibles y no escondidas detrás del hover, que en una pantalla táctil no
 * existe. También hacen la lista operable con teclado.
 *
 * Vive a nivel de módulo a propósito: definida dentro del componente padre,
 * React la trataría como un tipo nuevo en cada render y la remontaría, con lo
 * que el foco se perdería justo después de cada clic.
 */
export function FlechasDeOrden({ indice, total, onMover, etiqueta }: {
  indice: number
  total: number
  /** Recibe la posición destino. El padre decide cómo aplicar el movimiento. */
  onMover: (hasta: number) => void
  /** Singular, para el lector de pantalla: "campo", "opción". */
  etiqueta: string
}) {
  const btn = [
    'relative after:absolute after:content-[\'\'] after:-inset-1',
    'h-4 w-5 rounded flex items-center justify-center transition-colors',
    'hover:bg-navy/10',
    'disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed',
  ].join(' ')

  return (
    <div className="shrink-0 flex flex-col">
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onMover(indice - 1) }}
        disabled={!puedeSubir(indice)}
        className={btn}
        aria-label={`Subir ${etiqueta} ${indice + 1}`}
      >
        <ChevronUp size={12} className="text-navy-light/80" />
      </button>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onMover(indice + 1) }}
        disabled={!puedeBajar(indice, total)}
        className={btn}
        aria-label={`Bajar ${etiqueta} ${indice + 1}`}
      >
        <ChevronDown size={12} className="text-navy-light/80" />
      </button>
    </div>
  )
}
