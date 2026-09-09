'use client'

import { useState } from 'react'
import { Check, Loader2, AlertCircle } from 'lucide-react'
import {
  RESTRICCIONES_ALIMENTICIAS, CLAVE_OTROS, normalizarRestricciones, textoDeRestricciones,
} from '@/lib/members/restriccion-alimenticia'

/**
 * Checkboxes de restricción alimenticia, con guardado propio.
 *
 * Mismo trato que el resto de la edición en sitio: guarda al confirmar, avisa
 * "Guardado en tu perfil ✓", y si falla el error SE VE y lo marcado NO se
 * revierte — la persona no pierde lo que acaba de indicar por un fallo de red.
 *
 * Los checkboxes guardan al tocarlos; el texto de "Otros" al salir del campo,
 * porque guardar en cada tecla mandaría una petición por letra. Marcar "Otros"
 * no guarda todavía: espera el texto, que es lo que la validación exige.
 */
export function RestriccionAlimenticia({
  valores,
  otro,
  memberId,
  soloLectura = false,
  onGuardado,
}: {
  valores: readonly string[]
  otro: string | null
  memberId: string
  soloLectura?: boolean
  onGuardado?: (valores: string[], otro: string | null) => void
}) {
  const [marcadas, setMarcadas] = useState<string[]>([...valores])
  const [texto, setTexto] = useState(otro ?? '')
  const [estado, setEstado] = useState<'quieto' | 'guardando' | 'guardado'>('quieto')
  const [error, setError] = useState<string | null>(null)

  if (soloLectura) {
    return (
      <p className="text-[13px] font-semibold font-body">{textoDeRestricciones(valores, otro)}</p>
    )
  }

  /**
   * `mostrarError`: marcar "Otros" y todavía no haber escrito NO es un error que
   * mostrar —falta escribir, nada más—, pero salir del campo dejándolo vacío sí.
   * Sin esa distinción el guardado fallaba en silencio: ni se guardaba ni se
   * avisaba, que es la peor de las dos.
   */
  async function guardar(nuevas: string[], nuevoTexto: string, mostrarError = true) {
    const norm = normalizarRestricciones(nuevas, nuevoTexto)
    if (!norm.ok) {
      setError(mostrarError ? (norm.error ?? null) : null)
      return
    }
    setEstado('guardando')
    setError(null)
    try {
      const res = await fetch(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dietary_restrictions: norm.restricciones,
          dietary_restrictions_other: norm.otro,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'No se pudo guardar.')
      setMarcadas(norm.restricciones)
      setTexto(norm.otro ?? '')
      setEstado('guardado')
      setTimeout(() => setEstado('quieto'), 2500)
      onGuardado?.(norm.restricciones, norm.otro)
    } catch (e) {
      // Se conserva lo marcado: revertir tiraría lo que la persona acaba de
      // indicar y la dejaría creyendo que no lo tocó.
      setEstado('quieto')
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    }
  }

  function alternar(clave: string) {
    const nuevas = marcadas.includes(clave)
      ? marcadas.filter(c => c !== clave)
      : [...marcadas, clave]
    setMarcadas(nuevas)
    // Al desmarcar "Otros" el texto se va con él: dejarlo escondido haría que
    // reapareciera solo la próxima vez que alguien marque la opción.
    const t = nuevas.includes(CLAVE_OTROS) ? texto : ''
    if (!nuevas.includes(CLAVE_OTROS)) setTexto('')
    void guardar(nuevas, t, false)
  }

  const muestraOtros = marcadas.includes(CLAVE_OTROS)

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

      {muestraOtros && (
        <input
          value={texto}
          onChange={e => { setTexto(e.target.value); if (error) setError(null) }}
          onBlur={e => guardar(marcadas, e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
          placeholder="¿Cuál?"
          aria-label="Detalle de la restricción alimenticia"
          aria-invalid={!!error}
          className="w-full rounded-lg border border-[var(--outline-variant)] bg-surface-card px-2 py-1.5 text-[13px] text-navy outline-none focus:border-navy/30 focus:ring-2 focus:ring-navy/10 font-body"
        />
      )}

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
