'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { AccessDenied } from '@/components/shared/AccessDenied'
import { RequestBoard } from '@/components/shared/RequestBoard'
import { TABS_DE_SOPORTE, ETIQUETA_DE_TIPO } from '@/lib/support/tiquete'
import type { SupportTicket } from '@/lib/supabase/queries/support-tickets'
import { formatDate } from '@/lib/format'

/**
 * SOP-1 · La cola de soporte.
 *
 * Es el tablero de siempre (RequestBoard): tomar, resolver, rechazar, con el
 * historial de cada tiquete. La ven solo `soporte_tecnico` y admin — el
 * módulo `soporte` lo da ese rol y nadie más.
 */
export default function SoportePage() {
  const { can, loaded } = usePermissions()
  const canView = can('soporte', 'view')
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)

  // Nace cargando; una recarga posterior no vuelve a encender el estado
  // (la lista vieja se queda hasta que llega la nueva).
  const cargar = useCallback(() => {
    fetch('/api/support-tickets')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: SupportTicket[]) => setTickets(Array.isArray(d) ? d : []))
      .catch(() => setTickets([]))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { if (loaded && canView) cargar() }, [loaded, canView, cargar])

  const onUpdated = (u: SupportTicket) => setTickets(prev => prev.map(t => (t.id === u.id ? u : t)))

  if (loaded && !canView) return <AccessDenied />

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-navy p-6 text-white">
        <h1 className="text-2xl font-display font-extrabold tracking-[-0.02em]">Soporte</h1>
        <p className="mt-1 text-sm text-white/80 font-body">
          Lo que la puerta levanta en los eventos: correos, perfiles, familias, accesos. Se toma, se resuelve y queda el rastro.
        </p>
      </div>

      <RequestBoard
        requests={tickets}
        loading={loading}
        tabs={TABS_DE_SOPORTE}
        typeLabel={ETIQUETA_DE_TIPO}
        endpointBase="/api/support-tickets"
        onUpdated={onUpdated}
        renderDetails={t => (
          <div className="space-y-2 text-sm font-body text-navy">
            <p className="whitespace-pre-wrap">{t.details}</p>
            <p className="text-[13px] text-navy-light/80">
              Levantado por <span className="font-medium text-navy">{t.member_name}</span> el {formatDate(t.created_at)}
              {t.event_name && <> · en <span className="font-medium text-navy">{t.event_name}</span></>}
              {t.subject_name && <> · sobre <a href={`/miembros/${t.subject_member_id}`} className="font-medium text-coral-deep hover:underline">{t.subject_name}</a></>}
            </p>
          </div>
        )}
      />
    </div>
  )
}
