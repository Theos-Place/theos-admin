'use client'

import { useState, useCallback } from 'react'
import { Undo2 } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/shared/Button'
import { useToast } from '@/components/shared/Toast'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/lib/format'
import {
  PUEDEN_SOLICITAR_DEVOLUCION, validarJustificacion, JUSTIFICACION_MAX,
} from '@/lib/studies/solicitud-de-devolucion'
import type { RoleId } from '@/types/auth'

type Matricula = {
  enrollment_id: string
  estudio: string
  grupo: string | null
  estado: string | null
  fecha: string | null
  /** null = se puede pedir. Si no, por qué no. */
  motivo: string | null
}

/**
 * DEV-2 · "Solicitar devolución" en la sección administrativa del perfil.
 *
 * NO MUESTRA NADA DE PAGOS, y esa es la regla del acuerdo: ni montos, ni
 * métodos, ni si el pago fue por SINPE. Quien pide elige la MATRÍCULA y
 * escribe por qué; finanzas encuentra el pago y verifica el ingreso.
 *
 * Las matrículas que NO se pueden pedir se muestran igual, deshabilitadas y
 * con el motivo. Esconderlas dejaría a quien pide sin saber si se equivocó de
 * persona o si el sistema no tiene el pago — las dos se ven igual, y la
 * segunda termina en un mensaje a TI.
 */
export function RequestRefundButton({ memberId, memberName = 'esta persona' }: {
  memberId: string
  memberName?: string
}) {
  const toast = useToast()
  const { hasRole, loaded } = useAuth()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Matricula[] | null>(null)
  const [elegida, setElegida] = useState('')
  const [justificacion, setJustificacion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setItems(null); setError(null)
    try {
      const r = await fetch(`/api/studies/refund-requests?member_id=${encodeURIComponent(memberId)}`)
      const d = await r.json().catch(() => null) as { items?: Matricula[]; error?: string } | null
      if (!r.ok) throw new Error(d?.error ?? 'No se pudieron cargar las matrículas.')
      setItems(d?.items ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las matrículas.')
      setItems([])
    }
  }, [memberId])

  /** Abrir y cargar van juntos, en el CLIC y no en un efecto: `cargar` hace
   *  `setItems(null)` para mostrar el "Cargando…", y hacerlo desde un efecto
   *  es un setState sincrónico que dispara un render en cascada (la regla
   *  `react-hooks/set-state-in-effect`, que este repo trata como warning). */
  function abrir() {
    setOpen(true)
    void cargar()
  }

  // Hasta que carguen los roles no se sabe: pintar el botón antes y quitarlo
  // después deja un parpadeo en cada carga del perfil.
  if (!loaded) return null
  if (!hasRole(...(PUEDEN_SOLICITAR_DEVOLUCION as readonly RoleId[]))) return null

  const problema = validarJustificacion(justificacion)
  const puedeMandar = !!elegida && !problema && !guardando

  async function enviar() {
    if (!puedeMandar) return
    setGuardando(true); setError(null)
    try {
      const r = await fetch('/api/studies/refund-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollment_id: elegida, justificacion: justificacion.trim() }),
      })
      const d = await r.json().catch(() => null) as { error?: string } | null
      if (!r.ok) throw new Error(d?.error ?? 'No se pudo crear la solicitud.')
      toast('Solicitud enviada a finanzas.', 'success')
      setOpen(false); setElegida(''); setJustificacion('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la solicitud.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <Button variante="secundario" tamano="sm" onClick={abrir}>
        <Undo2 size={14} aria-hidden />
        Solicitar devolución
      </Button>

      {open && (
        <Modal onClose={() => setOpen(false)} titleId="devolucion-titulo" width={480}>
          <div className="p-6 space-y-4">
            <h3 id="devolucion-titulo" className="text-lg font-extrabold text-navy font-display">
              Solicitar devolución
            </h3>
            <p className="text-[13px] text-navy-light/80 font-body">
              Elegí la matrícula de {memberName} y contá por qué se devuelve. La solicitud
              le llega a finanzas, que verifica el ingreso y la resuelve.
            </p>

            {items === null && (
              <p className="text-[13px] text-navy-light/80 font-body">Cargando matrículas…</p>
            )}

            {items?.length === 0 && (
              <p className="text-[13px] text-navy-light/80 font-body">
                Esta persona no tiene matrículas registradas.
              </p>
            )}

            {!!items?.length && (
              <fieldset className="space-y-1.5">
                <legend className="text-[13px] text-navy-light/80 font-display mb-1">Matrícula</legend>
                {items.map(m => (
                  <label
                    key={m.enrollment_id}
                    className={`flex items-start gap-2 rounded-xl p-2.5 ${
                      m.motivo ? 'opacity-60' : 'hover:bg-surface-low cursor-pointer'
                    }`}
                  >
                    <input
                      type="radio"
                      name="matricula"
                      value={m.enrollment_id}
                      checked={elegida === m.enrollment_id}
                      disabled={!!m.motivo}
                      onChange={e => setElegida(e.target.value)}
                      className="mt-1 accent-coral"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm text-navy font-body">{m.estudio}</span>
                      <span className="block text-[13px] text-navy-light/80 font-body">
                        {[m.grupo, m.fecha ? formatDate(m.fecha) : null].filter(Boolean).join(' · ')}
                      </span>
                      {m.motivo && (
                        <span className="block text-[13px] text-coral-deep font-body mt-0.5">{m.motivo}</span>
                      )}
                    </span>
                  </label>
                ))}
              </fieldset>
            )}

            <div>
              <label htmlFor="justificacion-devolucion" className="block text-[13px] text-navy-light/80 font-display mb-1">
                Por qué se devuelve
              </label>
              <textarea
                id="justificacion-devolucion"
                value={justificacion}
                onChange={e => setJustificacion(e.target.value)}
                maxLength={JUSTIFICACION_MAX}
                rows={3}
                className="w-full rounded-xl bg-surface-low px-3 py-2 text-[13px] text-navy font-body outline-none focus:ring-1 focus:ring-coral/30"
                placeholder="El grupo se canceló y la persona no pudo pasarse a otro."
              />
              {/* El mensaje solo aparece cuando ya escribió algo: decirle que
                  es muy corto a un campo vacío es regañar antes de tiempo. */}
              {justificacion.trim() && problema && (
                <p className="mt-1 text-[13px] text-coral-deep font-body">{problema}</p>
              )}
            </div>

            {error && <p className="text-[13px] text-coral-deep font-body" role="alert">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button variante="fantasma" tamano="sm" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button variante="primario" tamano="sm" onClick={enviar} disabled={!puedeMandar}>
                {guardando ? 'Enviando…' : 'Enviar solicitud'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
