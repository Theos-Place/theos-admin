'use client'

/**
 * Las respuestas al formulario de inscripción que llegaron por el LINK PÚBLICO,
 * sin entrar al sistema (2026-10-19). No son inscripciones —no tienen ficha—,
 * así que van aparte. Desde FRM-9 (2026-10-29) se pueden VINCULAR a una ficha
 * desde acá mismo: el componente compartido propone la ficha por correo o
 * nombre y, al confirmar, crea la inscripción al evento.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RespuestasSinFicha } from '@/components/forms/RespuestasSinFicha'

export function InscritosSinFicha({ eventId, onVinculado }: { eventId: string; onVinculado?: () => void }) {
  const [formId, setFormId] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    fetch(`/api/events/${eventId}/guest-responses`)
      .then(r => (r.ok ? r.json() : null))
      .then(x => { if (vivo && x?.formId) setFormId(x.formId) })
      .catch(() => {})
    return () => { vivo = false }
  }, [eventId])

  if (!formId) return null
  return (
    <div className="mt-4 space-y-2">
      <RespuestasSinFicha
        formId={formId}
        descripcion="Llenaron el formulario sin entrar al sistema, así que no quedaron inscritos ni con cobro. Si tienen ficha, vinculalos acá: queda la inscripción (pagada si adjuntó el comprobante; si no, pendiente), sin correo, y su check-in del evento pasa a su historial."
        onVinculado={onVinculado}
      />
      <Link href={`/formularios/${formId}/respuestas`} className="inline-block text-[13px] text-navy underline font-body">
        Ver sus respuestas
      </Link>
    </div>
  )
}
