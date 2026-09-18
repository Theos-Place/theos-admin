'use client'

import { useState } from 'react'
import { Check, Loader2, AlertCircle } from 'lucide-react'
import {
  estadoDeAutorizacion, aValorGuardado, ETIQUETA, TEXTO_DE_LA_CASILLA,
  type EstadoDeAutorizacion,
} from '@/lib/members/autorizacion-de-imagen'
import { cn } from '@/lib/utils'

/**
 * FAM-3 · Autorización de imagen, con guardado propio.
 *
 * SON TRES BOTONES Y NO UNA CASILLA. Una casilla solo sabe decir sí o no, y acá
 * el tercer estado —"todavía no se le preguntó"— es el que importa: es la
 * señal de a quién hay que ir a consultar. Con una casilla, destildarla
 * significaría "dijo que no" y no habría forma de volver a "pendiente".
 *
 * Mismo trato que el resto de la edición en sitio (ver RestriccionAlimenticia):
 * guarda al tocar, avisa, y si falla el error SE VE y lo elegido NO se revierte.
 */
export function AutorizacionDeImagen({
  valor, memberId, soloLectura = false, onGuardado,
}: {
  valor: boolean | null | undefined
  memberId: string
  soloLectura?: boolean
  onGuardado?: (v: boolean | null) => void
}) {
  const [elegido, setElegido] = useState<EstadoDeAutorizacion>(estadoDeAutorizacion(valor))
  const [estado, setEstado] = useState<'quieto' | 'guardando' | 'guardado'>('quieto')
  const [error, setError] = useState<string | null>(null)

  if (soloLectura) {
    return <p className="text-[13px] font-semibold font-body">{ETIQUETA[estadoDeAutorizacion(valor)]}</p>
  }

  async function guardar(nuevo: EstadoDeAutorizacion) {
    setElegido(nuevo)
    setEstado('guardando')
    setError(null)
    try {
      const res = await fetch(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autorizacion_imagen: aValorGuardado(nuevo) }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'No se pudo guardar.')
      setEstado('guardado')
      setTimeout(() => setEstado('quieto'), 2500)
      onGuardado?.(aValorGuardado(nuevo))
    } catch (e) {
      // No se revierte: tirar lo que la persona acaba de indicar la dejaría
      // creyendo que no lo tocó.
      setEstado('quieto')
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    }
  }

  const opciones: Array<[EstadoDeAutorizacion, string]> = [
    ['si', 'Sí, autoriza'], ['no', 'No autoriza'], ['pendiente', 'Sin preguntar'],
  ]

  return (
    <div className="space-y-2">
      <p className="text-[13px] text-navy-light/80 font-body">{TEXTO_DE_LA_CASILLA}</p>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={TEXTO_DE_LA_CASILLA}>
        {opciones.map(([v, texto]) => (
          <button
            key={v} type="button" role="radio" aria-checked={elegido === v}
            onClick={() => guardar(v)}
            className={cn('rounded-full px-3.5 py-1.5 text-[13px] font-body transition-colors',
              elegido === v
                ? v === 'si' ? 'bg-teal-deep text-white'
                  : v === 'no' ? 'bg-coral text-white'
                  : 'bg-navy text-white'
                : 'bg-surface-low text-navy-light/80 hover:bg-navy/5')}
          >
            {texto}
          </button>
        ))}
      </div>
      {estado === 'guardando' && (
        <p className="flex items-center gap-1 text-[11px] text-navy-light/80 font-body">
          <Loader2 size={10} className="animate-spin" aria-hidden /> Guardando…
        </p>
      )}
      {estado === 'guardado' && (
        <p role="status" className="flex items-center gap-1 text-[11px] text-teal-deep font-body">
          <Check size={11} aria-hidden /> Guardado
        </p>
      )}
      {error && (
        <p role="alert" className="flex items-start gap-1 text-[11px] text-coral-deep font-body">
          <AlertCircle size={11} className="mt-0.5 shrink-0" aria-hidden /> {error}
        </p>
      )}
    </div>
  )
}
