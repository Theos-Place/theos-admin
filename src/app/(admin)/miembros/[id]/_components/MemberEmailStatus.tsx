'use client'

import { useState, useEffect, useCallback } from 'react'
import { Mail, AlertTriangle, MailCheck, MailX } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { DeleteConfirmModal } from '@/components/shared/DeleteConfirmModal'
import { formatDate } from '@/lib/format'

type Status = {
  subscribed: boolean
  opted_out_at: string | null
  bounced: boolean
  bounced_at: string | null
  complained: boolean
  complained_at: string | null
}

/** Estado de comunicaciones por email del miembro + acciones (suscribir / dar de
 *  baja / limpiar rebote-queja). Solo visible para comunicaciones/admin/dirección. */
export function MemberEmailStatus({ memberId }: { memberId: string }) {
  const { hasRole, loaded } = useAuth()
  const canManage = hasRole('comunicaciones', 'admin', 'direccion')

  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const load = useCallback(() => {
    return fetch(`/api/members/${memberId}/email-status`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('No se pudo cargar el estado'))))
      .then((d: Status) => { setStatus(d); setError(null) })
      .catch(e => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false))
  }, [memberId])

  useEffect(() => { if (canManage) load() }, [canManage, load])

  async function act(action: 'subscribe' | 'unsubscribe' | 'clear_flags') {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/members/${memberId}/email-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error()
      load()
    } catch {
      setError('No se pudo aplicar el cambio. Intentá de nuevo.')
    } finally {
      setBusy(false)
      setConfirmClear(false)
    }
  }

  if (!loaded || !canManage) return null

  return (
    <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]">
      <div className="flex items-center gap-2 mb-3">
        <Mail size={15} className="text-navy-light/60" />
        <p className="text-[10px] uppercase tracking-wider text-navy-light/60 font-display">
          Comunicaciones por email
        </p>
      </div>

      {loading ? (
        <div className="h-16 rounded-xl bg-surface-low animate-pulse" />
      ) : error && !status ? (
        <p className="text-sm text-coral font-body">{error}</p>
      ) : status ? (
        <div className="space-y-4">
          {/* Estado de suscripción */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm text-navy font-body">
                {status.subscribed ? 'Suscrito a marketing' : 'Dado de baja del marketing'}
                {!status.subscribed && status.opted_out_at && (
                  <span className="text-navy-light/60"> · {formatDate(status.opted_out_at)}</span>
                )}
              </p>
              {/* Badges de rebote/queja */}
              {(status.bounced || status.complained) && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {status.bounced && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-[11px] font-medium font-body">
                      <AlertTriangle size={11} /> Correo rebotado
                    </span>
                  )}
                  {status.complained && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-coral/10 text-coral px-2 py-0.5 text-[11px] font-medium font-body">
                      <AlertTriangle size={11} /> Marcó como spam
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Acción de suscripción */}
            {status.subscribed ? (
              <button
                type="button"
                onClick={() => act('unsubscribe')}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] text-navy-light hover:bg-surface-low transition-colors disabled:opacity-40 border-[var(--outline-variant)] font-body shrink-0"
              >
                <MailX size={14} /> Dar de baja
              </button>
            ) : (
              <button
                type="button"
                onClick={() => act('subscribe')}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full bg-coral px-3.5 py-2 text-[13px] text-white hover:bg-coral-deep transition-colors disabled:opacity-40 font-body shrink-0"
              >
                <MailCheck size={14} /> Volver a suscribir
              </button>
            )}
          </div>

          {/* Caso especial: limpiar rebote/queja */}
          {(status.bounced || status.complained) && (
            <div className="rounded-xl bg-surface-low p-3 flex items-start justify-between gap-3 flex-wrap">
              <p className="text-[12px] text-navy-light/70 font-body flex-1 min-w-[180px]">
                Reactivá el envío a esta dirección solo si el correo se corrigió o fue un falso positivo. Re-habilitar un correo problemático afecta la reputación de envío.
              </p>
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] text-navy-light hover:bg-surface-low transition-colors disabled:opacity-40 border-[var(--outline-variant)] font-body shrink-0"
              >
                Limpiar estado de rebote/queja
              </button>
            </div>
          )}

          {error && <p className="text-[12px] text-coral font-body">{error}</p>}
        </div>
      ) : null}

      <DeleteConfirmModal
        open={confirmClear}
        title="Limpiar estado de rebote/queja"
        description="Esto re-habilita el envío de correo a esta dirección. Hacelo solo si el correo se corrigió o fue un falso positivo: re-habilitar un correo problemático afecta la reputación de envío. Escribí «confirmar» para continuar."
        keyword="confirmar"
        confirmLabel="Limpiar estado"
        loading={busy}
        onConfirm={() => act('clear_flags')}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  )
}
