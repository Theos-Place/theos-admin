'use client'

import { useEffect, useState } from 'react'
import { Loader2, ArrowRight, AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { cn } from '@/lib/utils'

/**
 * Mover a una persona de grupo, con su pago.
 *
 * Lo importante de esta pantalla es que NO sorprenda: antes de confirmar dice
 * exactamente qué va a pasar con la matrícula y con la plata, y el monto sale
 * del servidor (misma regla que va a ejecutar), no de una cuenta hecha acá.
 */
type Destino = {
  id: string
  name: string
  costo: number
  currency: string | null
  cupo: number | null
  inscritos: number
  cobrar: number
  saldo_a_favor: number
  mensaje: string
}

const plata = (n: number, moneda: string | null) =>
  `${moneda === 'USD' ? '$' : '₡'}${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`

export function MoverDeGrupoModal({
  enrollmentId, personaNombre, onClose, onMovido,
}: {
  enrollmentId: string
  personaNombre: string
  onClose: () => void
  onMovido: (mensaje: string) => void
}) {
  const [cargando, setCargando] = useState(true)
  const [origen, setOrigen] = useState<{ name: string; costo: number; currency: string | null } | null>(null)
  const [destinos, setDestinos] = useState<Destino[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [elegido, setElegido] = useState<string>('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    fetch(`/api/studies/enrollments/${enrollmentId}/transfer`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('No se pudieron cargar los grupos.')))
      .then(d => { if (!vivo) return; setOrigen(d.origen); setDestinos(d.destinos ?? []) })
      .catch(e => vivo && setError(e.message))
      .finally(() => vivo && setCargando(false))
    return () => { vivo = false }
  }, [enrollmentId])

  const filtrados = busqueda.trim()
    ? destinos.filter(d => d.name.toLowerCase().includes(busqueda.trim().toLowerCase()))
    : destinos
  const destino = destinos.find(d => d.id === elegido) ?? null

  async function mover() {
    if (!destino) return
    setEnviando(true); setError(null)
    try {
      const res = await fetch(`/api/studies/enrollments/${enrollmentId}/transfer`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_group_id: destino.id }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? 'No se pudo mover.')
      onMovido(body?.resumen ?? 'Persona movida de grupo.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo mover.')
      setEnviando(false)
    }
  }

  return (
    <Modal onClose={onClose} titleId="mover-grupo-title" width={560}>
      <div className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
        <h2 id="mover-grupo-title" className="text-base font-bold text-navy font-display">
          Mover a {personaNombre} de grupo
        </h2>
        {origen && (
          <p className="text-[13px] text-navy-light/80 font-body">
            Hoy está en <strong className="text-navy">{origen.name}</strong> ({plata(origen.costo, origen.currency)}).
          </p>
        )}

        {cargando ? (
          <div className="flex items-center gap-2 py-8 justify-center text-navy-light/80">
            <Loader2 size={16} className="animate-spin" aria-hidden />
            <span className="text-sm font-body">Buscando grupos…</span>
          </div>
        ) : destinos.length === 0 ? (
          <p className="text-sm text-navy-light/80 font-body py-6 text-center">
            No hay ningún grupo abierto al que se pueda mover ahora.
          </p>
        ) : (
          <>
            <div className="space-y-1.5">
              <label htmlFor="buscar-grupo-destino" className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
                Grupo destino ({destinos.length} disponibles)
              </label>
              <input
                id="buscar-grupo-destino"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre…"
                className="w-full rounded-xl border border-[var(--outline-variant)] px-3 py-2 text-sm font-body"
              />
            </div>

            <div className="max-h-64 overflow-y-auto rounded-xl border border-[var(--outline-variant)] divide-y divide-[var(--outline-variant)]">
              {filtrados.map(d => (
                <button
                  key={d.id}
                  onClick={() => setElegido(d.id)}
                  aria-pressed={elegido === d.id}
                  className={cn(
                    'w-full text-left px-3 py-2.5 transition-colors',
                    elegido === d.id ? 'bg-coral/5' : 'hover:bg-surface-low',
                  )}
                >
                  <span className={cn('text-[13px] font-body block', elegido === d.id ? 'text-coral font-semibold' : 'text-navy')}>
                    {d.name}
                  </span>
                  <span className="text-[11px] text-navy-light/80 font-body">
                    {plata(d.costo, d.currency)}
                    {d.cupo !== null && ` · ${d.inscritos} de ${d.cupo}`}
                    {d.cobrar > 0 && ` · faltarían ${plata(d.cobrar, d.currency)}`}
                    {d.saldo_a_favor > 0 && ` · le quedarían ${plata(d.saldo_a_favor, d.currency)} a favor`}
                  </span>
                </button>
              ))}
              {filtrados.length === 0 && (
                <p className="px-3 py-4 text-[13px] text-navy-light/80 font-body">Ningún grupo con ese nombre.</p>
              )}
            </div>

            {/* La confirmación: qué pasa con la matrícula Y con la plata, antes
                de tocar nada. El texto viene del servidor. */}
            {destino && (
              <div className="rounded-xl bg-surface-low p-4 space-y-2">
                <p className="text-[13px] text-navy font-body flex items-center gap-2 flex-wrap">
                  <strong>{origen?.name}</strong>
                  <ArrowRight size={13} className="text-navy-light/80" aria-hidden />
                  <strong>{destino.name}</strong>
                </p>
                <p className="text-[13px] text-navy-light/80 font-body">
                  Su matrícula actual se cierra como <strong className="text-navy">transferida</strong> y queda
                  matriculada en el grupo nuevo.
                </p>
                <p className={cn('text-[13px] font-body', destino.cobrar > 0 ? 'text-coral-deep font-semibold' : 'text-navy-light/80')}>
                  {destino.mensaje}
                </p>
              </div>
            )}
          </>
        )}

        {error && (
          <p className="text-[13px] text-coral-deep font-body flex items-start gap-1.5" role="alert">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            disabled={!destino || enviando}
            onClick={mover}
            className="flex-1 rounded-full bg-coral px-4 py-2.5 text-sm text-white hover:bg-coral-deep transition-all disabled:opacity-40 font-body"
          >
            {enviando ? 'Moviendo…' : 'Mover de grupo'}
          </button>
          <button
            onClick={onClose}
            className="rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
          >
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  )
}
