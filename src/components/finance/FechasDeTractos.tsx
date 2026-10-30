'use client'

// FIN-15 · Frecuencia «personalizada»: un selector de fecha por tracto. Lo
// usan las dos pantallas que arman arreglos (la cola de pagos y «Ofrecer
// arreglo» de una beca), así que la regla de qué se pide vive en un lugar.

import { DatePicker } from '@/components/events/DatePicker'
import { motivoFechasPersonalizadas } from '@/lib/finance/installments'

/** Ajusta el arreglo de fechas al número de tractos sin perder lo ya escogido. */
export function fechasParaTractos(fechas: readonly string[], count: number): string[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => fechas[i] ?? '')
}

export function FechasDeTractos({ count, fechas, onChange, idBase }: {
  count: number
  fechas: readonly string[]
  onChange: (fechas: string[]) => void
  /** Prefijo de ids, por si hay dos en la misma pantalla. */
  idBase: string
}) {
  const lista = fechasParaTractos(fechas, count)
  const motivo = lista.every(f => f) ? motivoFechasPersonalizadas(lista, count) : null
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {lista.map((f, i) => (
          <div key={i} className="space-y-1">
            <span className="block text-[13px] text-navy-light/80 font-display">Tracto {i + 1}</span>
            <DatePicker
              id={`${idBase}-${i + 1}`}
              ariaLabel={`Vencimiento del tracto ${i + 1}`}
              value={f}
              onChange={v => onChange(lista.map((x, j) => (j === i ? v : x)))}
              className="rounded-xl bg-surface-low px-3 py-1.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
            />
          </div>
        ))}
      </div>
      {motivo && <p className="text-[13px] text-coral-deep font-body" role="alert">{motivo}</p>}
    </div>
  )
}
