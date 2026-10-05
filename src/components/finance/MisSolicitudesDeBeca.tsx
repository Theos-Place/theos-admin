'use client'

/**
 * Las solicitudes de beca de UNA persona, como las ve ella.
 *
 * Vive acá y no dentro de la ficha porque se dibuja en DOS lugares: la
 * pestaña de participación del perfil y /mis-pagos. Estaba solo en la ficha,
 * y con BEC-5 eso dejó de alcanzar: el aviso de «tu grupo se llenó» enlaza a
 * /mis-pagos, que mostraba las becas YA ASIGNADAS pero no las solicitudes —
 * o sea que el aviso mandaba a la persona a una pantalla donde no podía
 * hacer lo que el aviso le pedía.
 */

import { useState, useEffect, useCallback } from 'react'
import { Loader2, GraduationCap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import { CambiarGrupoDeBeca } from '@/components/finance/CambiarGrupoDeBeca'

export type SolicitudDeBecaPropia = {
  id: string
  entity_name: string | null
  status: 'open' | 'in_review' | 'por_modificar' | 'resolved' | 'rejected'
  reason: string
  review_notes: string | null
  created_at: string
  /** BEC-5 · El estudio, para ofrecerle los otros grupos del MISMO. */
  plan_id: string | null
}

export const SOLICITUD_LABEL: Record<string, string> = {
  open: 'Solicitada', in_review: 'En revisión', resolved: 'Aprobada', rejected: 'Rechazada',
  // BEC-5 · Para la persona NO dice «por modificar», que suena a trámite mal
  // hecho. Dice qué pasó y qué le toca.
  por_modificar: 'Elegí otro grupo',
}

export const SOLICITUD_BADGE: Record<string, string> = {
  open: 'bg-amber-50 text-amber-700', in_review: 'bg-amber-50 text-amber-700',
  resolved: 'bg-teal-soft/30 text-teal-deep', rejected: 'bg-coral-soft/20 text-coral',
  por_modificar: 'bg-amber-50 text-amber-700',
}

export function MisSolicitudesDeBeca({ memberId }: { memberId: string }) {
  const [rows, setRows] = useState<SolicitudDeBecaPropia[]>([])
  const [loading, setLoading] = useState(true)

  const recargar = useCallback(() => {
    fetch(`/api/finance/requests?type=scholarship&member_id=${memberId}`)
      .then(r => (r.ok ? r.json() : []))
      .then((d: SolicitudDeBecaPropia[]) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [memberId])

  useEffect(() => { recargar() }, [recargar])

  if (loading) {
    return (
      <p className="px-4 py-6 text-center text-sm text-navy-light/80 font-body inline-flex items-center gap-2 justify-center w-full">
        <Loader2 size={15} className="animate-spin" /> Cargando…
      </p>
    )
  }
  if (rows.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-navy-light/80 font-body flex items-center gap-2">
        <GraduationCap size={14} /> Sin solicitudes de beca.
      </p>
    )
  }
  return (
    <div className="divide-y divide-[var(--outline-variant)]">
      {rows.map(r => (
        <div key={r.id} className="px-4 py-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-navy font-body">{r.entity_name ?? '—'}</p>
            <p className="text-[13px] text-navy-light/80 font-body">{formatDate(r.created_at)}</p>
            {r.status === 'rejected' && r.review_notes && (
              <p className="text-[13px] text-coral font-body mt-1">Motivo: {r.review_notes}</p>
            )}
            {/* BEC-5 punto 5 · El grupo se llenó: elegir otro sin empezar de
                cero. Va acá y no en un modal aparte porque es UNA decisión,
                y la solicitud ya está en pantalla. */}
            {r.status === 'por_modificar' && (
              <CambiarGrupoDeBeca
                requestId={r.id}
                memberId={memberId}
                planId={r.plan_id}
                onCambiado={recargar}
              />
            )}
          </div>
          <span className={cn('rounded-full px-2.5 py-0.5 text-[13px] font-semibold font-display shrink-0', SOLICITUD_BADGE[r.status])}>
            {SOLICITUD_LABEL[r.status]}
          </span>
        </div>
      ))}
    </div>
  )
}
