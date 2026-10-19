'use client'

/**
 * Las respuestas al formulario de inscripción que llegaron por el LINK PÚBLICO,
 * sin entrar al sistema (2026-10-19). No son inscripciones —no tienen ficha—,
 * así que van aparte y dicen qué hacer con ellas.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { UserX } from 'lucide-react'
import { formatDate } from '@/lib/format'

type Item = { id: string; nombre: string; email: string | null; fecha: string }

export function InscritosSinFicha({ eventId }: { eventId: string }) {
  const [d, setD] = useState<{ formId: string | null; items: Item[] } | null>(null)
  useEffect(() => {
    let vivo = true
    fetch(`/api/events/${eventId}/guest-responses`)
      .then(r => (r.ok ? r.json() : null))
      .then(x => { if (vivo && x) setD(x) })
      .catch(() => {})
    return () => { vivo = false }
  }, [eventId])

  if (!d?.formId || d.items.length === 0) return null
  return (
    <section className="mt-4 rounded-2xl border border-coral/30 bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-3">
      <div className="flex items-start gap-2">
        <UserX size={18} className="mt-0.5 shrink-0 text-coral-deep" aria-hidden="true" />
        <div>
          <h3 className="text-[15px] font-bold text-navy font-display">
            Por el link público, sin ficha ({d.items.length})
          </h3>
          <p className="text-[13px] text-navy-light/80 font-body">
            Llenaron el formulario sin entrar al sistema, así que no quedaron inscritos ni con cobro.
            Si tienen ficha, hay que asociarlos; si no, escribirles para que se inscriban con su cuenta.
          </p>
        </div>
      </div>
      <ul className="divide-y divide-[var(--outline-variant)]">
        {d.items.map(i => (
          <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
            <span className="text-sm text-navy font-body">{i.nombre}</span>
            <span className="text-[13px] text-navy-light/80 font-body break-all">
              {i.email ?? 'Sin correo'} · {formatDate(i.fecha)}
            </span>
          </li>
        ))}
      </ul>
      <Link href={`/formularios/${d.formId}/respuestas`} className="inline-block text-[13px] text-navy underline font-body">
        Ver sus respuestas
      </Link>
    </section>
  )
}
