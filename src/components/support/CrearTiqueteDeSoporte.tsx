'use client'

import { useState } from 'react'
import { LifeBuoy } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/shared/Button'
import { motivoQueImpideCrear, MINIMO_DE_DETALLE } from '@/lib/support/tiquete'

/**
 * SOP-1 · El botón «Tiquete de soporte» de la puerta y su modal.
 *
 * Vive en la pantalla de check-in, que ya está cerrada a quien opera la mesa
 * (eventos:edit); por eso acá no se vuelve a preguntar por el permiso: el
 * endpoint lo exige y la pantalla no deja entrar a nadie más.
 *
 * Tres cosas y nada más: quién (sale de la sesión), cuándo (ahora) y el
 * texto. Se puede pasar el miembro que se estaba atendiendo si la pantalla lo
 * tiene a mano; si no, el texto lo dice.
 */
export function CrearTiqueteDeSoporte({ eventId, memberId, memberName }: {
  eventId?: string | null
  memberId?: string | null
  memberName?: string | null
}) {
  const [abierto, setAbierto] = useState(false)
  const [detalle, setDetalle] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState(false)

  function cerrar() {
    setAbierto(false); setDetalle(''); setError(null); setListo(false)
  }

  async function enviar() {
    const motivo = motivoQueImpideCrear(detalle)
    if (motivo) { setError(motivo); return }
    setEnviando(true); setError(null)
    try {
      const res = await fetch('/api/support-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ details: detalle, event_id: eventId ?? null, member_id: memberId ?? null }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error ?? 'No se pudo crear el tiquete.'); return }
      setListo(true)
    } catch {
      setError('No se pudo crear el tiquete.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <Button variante="fantasma" tamano="sm" onClick={() => setAbierto(true)} aria-label="Levantar un tiquete de soporte">
        <LifeBuoy size={15} aria-hidden /> <span className="hidden sm:inline">Tiquete de soporte</span>
      </Button>

      {abierto && (
        <Modal onClose={cerrar} titleId="tiquete-soporte-titulo" width={520}>
          <div className="p-6 space-y-4 font-body">
            <h2 id="tiquete-soporte-titulo" className="text-lg font-display font-bold text-navy">Tiquete de soporte</h2>
            {listo ? (
              <>
                <p className="text-sm text-navy">Listo. Soporte lo ve en su cola y queda el rastro de quién lo levantó y cuándo.</p>
                <div className="flex justify-end"><Button variante="primario" tamano="sm" onClick={cerrar}>Cerrar</Button></div>
              </>
            ) : (
              <>
                <p className="text-sm text-navy-light/80">
                  Contá qué pasó: a quién le pasa, qué dato hay que corregir, qué no funciona.
                  {memberName && <> Queda ligado a <span className="font-medium text-navy">{memberName}</span>.</>}
                </p>
                <textarea
                  value={detalle}
                  onChange={e => setDetalle(e.target.value)}
                  rows={5}
                  aria-label="Detalle del tiquete"
                  placeholder={`Ej.: «A María Pérez le sale otra familia al hacer check-in; su hija es Ana Pérez.» (mínimo ${MINIMO_DE_DETALLE} caracteres)`}
                  className="w-full rounded-xl border border-[var(--outline-variant)] bg-surface-card px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-coral"
                />
                {error && <p role="alert" className="text-[13px] text-coral-deep">{error}</p>}
                <div className="flex justify-end gap-2">
                  <Button variante="fantasma" tamano="sm" onClick={cerrar} disabled={enviando}>Cancelar</Button>
                  <Button variante="primario" tamano="sm" onClick={enviar} disabled={enviando}>{enviando ? 'Enviando…' : 'Levantar tiquete'}</Button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
