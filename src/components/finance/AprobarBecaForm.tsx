'use client'

/**
 * El formulario que "Resolver" pide cuando la solicitud es de BECA.
 *
 * Aprobar una beca no es marcar la solicitud como resuelta: hay que decir
 * cuánto es el descuento, porque de ahí sale la beca que después le da el
 * precio a la persona y el correo que le avisa. Sin esto, el tablero dejaba
 * cerrar la solicitud sin crear nada — pasó con seis el 2026-09-11.
 *
 * `onChange(null)` bloquea el botón mientras falte algo; el RequestBoard ya
 * respeta ese contrato (lo usa la reubicación de estudios).
 */
import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  validarAprobacion, avisoDeIncoherencia, textoDelDescuento,
  type TipoDescuento, type TipoAprobacion,
} from '@/lib/finance/aprobacion-de-beca'

export function AprobarBecaForm({ onChange }: {
  onChange: (payload: Record<string, unknown> | null) => void
}) {
  const [tipo, setTipo] = useState<TipoDescuento>('percentage')
  const [valor, setValor] = useState('100')
  const [aprobacion, setAprobacion] = useState<TipoAprobacion>('total')

  const v = validarAprobacion({ discount_type: tipo, discount_value: Number(valor), approval_type: aprobacion })
  const aviso = v.ok ? avisoDeIncoherencia(v.datos) : null

  useEffect(() => {
    onChange(v.ok ? { ...v.datos } : null)
    // `onChange` viene inline del tablero y cambia en cada render: incluirlo
    // dispararía el efecto en bucle. Lo que importa son los tres valores.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, valor, aprobacion])

  const campo = 'w-full rounded-lg border border-[var(--outline-variant)] bg-surface-card px-2.5 py-1.5 text-[13px] text-navy outline-none focus:border-navy/30 focus:ring-2 focus:ring-navy/10 font-body'

  return (
    <div className="rounded-xl border border-[var(--outline-variant)] bg-surface-low/40 p-3.5 space-y-3">
      <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display">
        Descuento de la beca
      </p>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="block text-[11px] text-navy-light/80 font-body mb-1">Tipo</span>
          <select value={tipo} onChange={e => setTipo(e.target.value as TipoDescuento)} className={campo} aria-label="Tipo de descuento">
            <option value="percentage">Porcentaje</option>
            <option value="fixed">Monto fijo</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-[11px] text-navy-light/80 font-body mb-1">
            {tipo === 'percentage' ? 'Porcentaje' : 'Monto'}
          </span>
          <input
            type="number" min={1} max={tipo === 'percentage' ? 100 : undefined}
            value={valor} onChange={e => setValor(e.target.value)}
            className={campo} aria-label={tipo === 'percentage' ? 'Porcentaje de descuento' : 'Monto del descuento'}
          />
        </label>
      </div>

      <div className="flex gap-2">
        {(['total', 'parcial'] as const).map(t => (
          <button
            key={t} type="button" onClick={() => setAprobacion(t)}
            aria-pressed={aprobacion === t}
            className={`flex-1 rounded-lg border px-3 py-1.5 text-[13px] transition-colors font-body ${
              aprobacion === t ? 'border-coral bg-coral/10 text-coral-deep font-semibold'
                : 'border-[var(--outline-variant)] text-navy-light hover:bg-surface-low'}`}
          >
            {t === 'total' ? 'Cubre todo' : 'Cubre una parte'}
          </button>
        ))}
      </div>

      {v.ok && (
        <p className="text-[13px] text-navy-light/80 font-body">
          Se va a crear una beca de <strong className="text-navy">{textoDelDescuento(v.datos)}</strong> y le
          va a llegar un correo avisándole que ya puede matricularse.
        </p>
      )}
      {!v.ok && <p className="text-[13px] text-coral-deep font-body">{v.error}</p>}
      {aviso && (
        <p className="flex items-start gap-1.5 text-[13px] text-navy-light font-body">
          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-500" aria-hidden />
          <span>{aviso}</span>
        </p>
      )}
    </div>
  )
}
