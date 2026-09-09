'use client'

import { useState } from 'react'
import { Check, Loader2, AlertCircle } from 'lucide-react'
import { RESTRICCIONES_ALIMENTICIAS, normalizarRestricciones, textoDeRestricciones } from '@/lib/members/restriccion-alimenticia'

/**
 * Checkboxes de restricción alimenticia, con guardado propio.
 *
 * Mismo trato que el resto de la edición en sitio: guarda al tocar, avisa
 * "Guardado en tu perfil ✓", y si falla el error SE VE y lo marcado NO se
 * revierte — la persona no pierde lo que acaba de indicar por un fallo de red.
 */
export function RestriccionAlimenticia({
  valores,
  memberId,
  soloLectura = false,
  onGuardado,
}: {
  valores: readonly string[]
  memberId: string
  soloLectura?: boolean
  onGuardado?: (valores: string[]) => void
}) {
  const [marcadas, setMarcadas] = useState<string[]>([...valores])
  const [estado, setEstado] = useState<'quieto' | 'guardando' | 'guardado'>('quieto')
  const [error, setError] = useState<string | null>(null)

  if (soloLectura) {
    return <p className="text-[13px] font-semibold font-body">{textoDeRestricciones(valores)}</p>
  }

  async function guardar(nuevas: string[]) {
    const norm = normalizarRestricciones(nuevas)
    if (!norm.ok) { setError(norm.error ?? null); return }
    setEstado('guardando')
    setError(null)
    try {
      const res = await fetch(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dietary_restrictions: norm.restricciones }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'No se pudo guardar.')
      setMarcadas(norm.restricciones)
      setEstado('guardado')
      setTimeout(() => setEstado('quieto'), 2500)
      onGuardado?.(norm.restricciones)
    } catch (e) {
      // Se conserva lo marcado: revertir tiraría lo que la persona acaba de
      // indicar y la dejaría creyendo que no lo tocó.
      setEstado('quieto')
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    }
  }

  function alternar(clave: string) {
    const nuevas = marcadas.includes(clave) ? marcadas.filter(c => c !== clave) : [...marcadas, clave]
    setMarcadas(nuevas)
    void guardar(nuevas)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {RESTRICCIONES_ALIMENTICIAS.map(r => (
          <label key={r.clave} className="flex cursor-pointer items-center gap-2 py-1">
            <input
              type="checkbox"
              className="accent-coral"
              checked={marcadas.includes(r.clave)}
              onChange={() => alternar(r.clave)}
            />
            <span className="text-[13px] text-navy font-body">{r.etiqueta}</span>
          </label>
        ))}
      </div>
      {estado === 'guardando' && (
        <p className="flex items-center gap-1 text-[11px] text-navy-light/80 font-body">
          <Loader2 size={10} className="animate-spin" aria-hidden /> Guardando…
        </p>
      )}
      {estado === 'guardado' && (
        <p role="status" className="flex items-center gap-1 text-[11px] text-teal-deep font-body">
          <Check size={11} aria-hidden /> Guardado en tu perfil
        </p>
      )}
      {error && (
        <p role="alert" className="flex items-start gap-1 text-[11px] text-coral-deep font-body">
          <AlertCircle size={11} className="mt-px shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}
