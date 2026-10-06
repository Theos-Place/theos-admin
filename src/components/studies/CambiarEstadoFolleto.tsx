'use client'

/**
 * FOL-2 · Cambio LIBRE de estado de un tiquete de folletos.
 *
 * El botón de al lado avanza un paso, que es el camino normal. Esto es para
 * el otro caso: el error de dedo. Un tiquete marcado «Enviado» por
 * equivocación se quedaba así para siempre, y devolverlo no era posible por
 * ninguna pantalla.
 *
 * TRES GUARDAS, y cada una responde a algo distinto:
 *  · La confirmación nombra el SALTO («¿Devolver de Enviado a Creada?»), no
 *    pregunta «¿seguro?» — que no informa nada.
 *  · Retroceder EXIGE una nota. Avanzar no: pedir justificación en el curso
 *    normal es fricción pura, pero un retroceso es siempre la corrección de
 *    algo y dentro de un mes alguien va a preguntar por qué.
 *  · Si el destino dispara un aviso, se dice que NO se va a reenviar.
 */

import { useState } from 'react'
import { Loader2, RotateCcw } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/shared/Button'
import { useToast } from '@/components/shared/Toast'
import { FOLLETO_STATES, FOLLETO_STATE_LABEL, type FolletoState } from '@/lib/studies/folletos'
import {
  notaObligatoria, textoDeConfirmacion, motivoQueImpide, disparaEfecto, AVISO_SIN_EFECTO,
} from '@/lib/studies/cambio-de-estado-folleto'

export function CambiarEstadoFolleto({ folletoId, estado, onCambiado }: {
  folletoId: string
  estado: FolletoState
  onCambiado: () => void
}) {
  const toast = useToast()
  const [abierto, setAbierto] = useState(false)
  const [destino, setDestino] = useState<FolletoState | ''>('')
  const [nota, setNota] = useState('')
  const [enviando, setEnviando] = useState(false)

  const pideNota = !!destino && notaObligatoria(estado, destino)
  const impide = destino ? motivoQueImpide({ desde: estado, hasta: destino, nota }) : 'Elegí un estado.'

  async function enviar() {
    if (enviando || !destino || impide) return
    setEnviando(true)
    try {
      const res = await fetch(`/api/studies/folletos/${folletoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: destino, ...(nota.trim() ? { nota: nota.trim() } : {}) }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo cambiar el estado.')
      toast(data?.mensaje ?? 'Estado cambiado.', 'success')
      setAbierto(false); setDestino(''); setNota('')
      onCambiado()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo cambiar el estado.', 'error')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <Button variante="secundario" tamano="sm" radio="pill" onClick={() => setAbierto(true)}>
        <RotateCcw size={13} aria-hidden="true" />
        Cambiar estado
      </Button>

      {abierto && (
        <Modal onClose={() => !enviando && setAbierto(false)} titleId="cambiar-estado-title" width={460}>
          <div className="p-6 space-y-4">
            <h3 id="cambiar-estado-title" className="text-base font-bold text-navy font-display">
              Cambiar el estado del tiquete
            </h3>
            <p className="text-[13px] text-navy-light/80 font-body">
              Ahora está en <strong className="text-navy">{FOLLETO_STATE_LABEL[estado]}</strong>.
              Podés moverlo adelante o atrás.
            </p>

            <div className="space-y-1">
              <label htmlFor="folleto-destino" className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
                Nuevo estado
              </label>
              <select
                id="folleto-destino"
                value={destino}
                onChange={e => setDestino(e.target.value as FolletoState)}
                className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
              >
                <option value="">Seleccionar…</option>
                {FOLLETO_STATES.filter(s => s !== estado).map(s => (
                  <option key={s} value={s}>{FOLLETO_STATE_LABEL[s]}</option>
                ))}
              </select>
            </div>

            {destino && (
              <p className="rounded-xl bg-surface-low px-3 py-2 text-[13px] text-navy font-body">
                {textoDeConfirmacion(estado, destino)}
              </p>
            )}

            {destino && disparaEfecto(destino) && (
              <p className="text-[13px] text-navy-light/80 font-body">{AVISO_SIN_EFECTO}</p>
            )}

            {pideNota && (
              <div className="space-y-1">
                <label htmlFor="folleto-nota" className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
                  ¿Por qué se devuelve? <span className="text-coral">*</span>
                </label>
                <textarea
                  id="folleto-nota"
                  value={nota}
                  onChange={e => setNota(e.target.value)}
                  rows={2}
                  placeholder="Ej: se marcó enviado por error, los folletos siguen en imprenta"
                  className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body resize-none"
                />
              </div>
            )}

            {destino && impide && (
              <p className="text-[13px] text-coral-deep font-body">{impide}</p>
            )}

            <div className="flex gap-2 pt-1">
              <Button variante="navy" ancho="flex" onClick={enviar} disabled={enviando || !!impide}>
                {enviando ? <><Loader2 size={15} className="animate-spin" /> Cambiando…</> : 'Cambiar el estado'}
              </Button>
              <Button variante="secundario" onClick={() => setAbierto(false)} disabled={enviando}>
                Cancelar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
