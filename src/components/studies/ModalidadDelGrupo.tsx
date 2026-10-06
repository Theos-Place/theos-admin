'use client'

/**
 * EST-14 · Bajo qué esquema cobra y entrega folletos este grupo.
 *
 * POR QUÉ SE PUEDE CAMBIAR A MANO. La marca inicial salió de un backfill
 * —todo lo que existía al 2026-10-05 quedó `legacy`, lo nuevo nace
 * `bloques`— y el sucesor la hereda del origen. Eso acierta casi siempre,
 * pero no hay forma de que acierte siempre: un grupo viejo que se vuelve a
 * usar, uno creado a mano para una cohorte vieja, o un backfill que no
 * previó un caso. Hasta hoy no había cómo arreglarlo, y un grupo mal marcado
 * cobra de más o deja a su gente sin folleto.
 *
 * NO ES UN INTERRUPTOR SUELTO. Dice qué significa cada opción y qué va a
 * pasar al cerrar, porque la palabra «legacy» no le dice nada a nadie y la
 * consecuencia es plata. Y pide confirmación: el cambio queda en el
 * audit_log, pero más vale no tener que buscarlo ahí.
 */

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/shared/Button'
import { useToast } from '@/components/shared/Toast'
import { modalidadDe, type Modalidad } from '@/lib/studies/modalidad-de-bloques'

const EXPLICACION: Record<Modalidad, { titulo: string; que: string }> = {
  legacy: {
    titulo: 'Esquema viejo (por nivel)',
    que: 'Su gente pagó y recibió folleto NIVEL POR NIVEL. Al cerrar, el paso '
      + 'al siguiente nivel genera el cobro y el tiquete de folletos.',
  },
  bloques: {
    titulo: 'Por bloques (N1+N2 / N3+N4)',
    que: 'Su gente pagó el PAR y recibió los dos folletos al matricularse. Al '
      + 'cerrar no se cobra ni se piden folletos: ya está todo cubierto.',
  },
}

export function ModalidadDelGrupo({ groupId, modalidad, onCambiada }: {
  groupId: string
  modalidad: string | null | undefined
  onCambiada?: (nueva: Modalidad) => void
}) {
  const toast = useToast()
  const actual = modalidadDe(modalidad)
  const otra: Modalidad = actual === 'legacy' ? 'bloques' : 'legacy'
  const [confirmando, setConfirmando] = useState(false)
  const [guardando, setGuardando] = useState(false)

  async function cambiar() {
    if (guardando) return
    setGuardando(true)
    try {
      const res = await fetch(`/api/studies/groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modalidad: otra }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        throw new Error(d?.error || 'No se pudo cambiar.')
      }
      toast(`El grupo quedó en «${EXPLICACION[otra].titulo}».`, 'success')
      setConfirmando(false)
      onCambiada?.(otra)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo cambiar.', 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <div className="rounded-xl border border-outline p-3 space-y-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
              Cobro y folletos
            </p>
            <p className="text-[13px] font-semibold text-navy font-body mt-0.5">
              {EXPLICACION[actual].titulo}
            </p>
          </div>
          <Button variante="secundario" tamano="sm" radio="xl" onClick={() => setConfirmando(true)}>
            Cambiar
          </Button>
        </div>
        <p className="text-[13px] text-navy-light/80 font-body">{EXPLICACION[actual].que}</p>
      </div>

      {confirmando && (
        <Modal onClose={() => !guardando && setConfirmando(false)} titleId="modalidad-title" width={460}>
          <div className="p-6 space-y-4">
            <h3 id="modalidad-title" className="text-base font-bold text-navy font-display">
              ¿Pasar el grupo a «{EXPLICACION[otra].titulo}»?
            </h3>
            <div className="rounded-xl bg-surface-low p-3 space-y-2">
              <p className="text-[13px] text-navy font-body">
                <strong>Ahora:</strong> {EXPLICACION[actual].que}
              </p>
              <p className="text-[13px] text-navy font-body">
                <strong>Quedaría:</strong> {EXPLICACION[otra].que}
              </p>
            </div>
            <p className="text-[13px] text-coral-deep font-body">
              Esto cambia si al cerrar se le cobra a la gente y si se piden sus folletos.
              Queda registrado quién lo cambió.
            </p>
            <div className="flex gap-2 pt-1">
              <Button variante="navy" ancho="flex" onClick={cambiar} disabled={guardando}>
                {guardando ? <><Loader2 size={15} className="animate-spin" /> Guardando…</> : 'Sí, cambiarlo'}
              </Button>
              <Button variante="secundario" onClick={() => setConfirmando(false)} disabled={guardando}>
                Cancelar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
