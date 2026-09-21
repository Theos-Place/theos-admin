'use client'

import { AlertTriangle } from 'lucide-react'
import {
  problemaDeLaSerie, duracionSospechosa, mensajeDelProblema, mensajeDeDuracion,
} from '@/lib/events/fin-de-la-serie'

type Props = {
  esRecurrente: boolean
  /** 'YYYY-MM-DD' del evento. */
  fechaInicio: string
  fechaFin: string
  /** 'YYYY-MM-DD' del "termina el" de la repetición. */
  finDeLaSerie: string
}

/**
 * Lo que el formulario no decía y costó una tarde (2026-09-21).
 *
 * Hay DOS "fin" y nada los distinguía: "Fecha fin" es cuándo termina ESTE
 * evento, y "Termina el" es cuándo deja de repetirse. Se puso la fecha de la
 * segunda repetición en el primero, el evento pasó a durar catorce días, y el
 * fin de la serie quedó antes del inicio — así que la serie no generaba nada y
 * el evento salía una sola vez, igual que si no se repitiera.
 *
 * Nada de esto se ve mirando el formulario lleno. Por eso el aviso está acá,
 * al lado de los campos, y no en un error después de guardar.
 */
export function AvisosDeLaSerie({ esRecurrente, fechaInicio, fechaFin, finDeLaSerie }: Props) {
  const problema = problemaDeLaSerie(esRecurrente, fechaInicio, finDeLaSerie)
  const dias = duracionSospechosa(esRecurrente, fechaInicio, fechaFin)
  const mensajes = [mensajeDelProblema(problema), dias ? mensajeDeDuracion(dias) : null].filter(Boolean)
  if (!mensajes.length) return null

  return (
    <div className="mt-3 space-y-2">
      {mensajes.map(m => (
        <p key={m} className="flex items-start gap-2 rounded-xl bg-coral/10 px-3 py-2 text-[13px] text-coral-deep font-body">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
          <span>{m}</span>
        </p>
      ))}
    </div>
  )
}
