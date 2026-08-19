'use client'

import { useState } from 'react'
import Link from 'next/link'
import { IdCard, X } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'

const DISMISS_KEY = 'cedula-reminder-dismissed'

/** Recordatorio persistente para que el miembro complete su cédula. Se puede
 *  posponer (cerrar) durante la sesión del navegador, pero reaparece en logins
 *  siguientes mientras falte la cédula. Excluye perfiles de sistema. */
export function CedulaReminderBanner() {
  const { user, loaded } = useAuth()
  // Posponer por sesión de navegador: sessionStorage se limpia al cerrarlo, así
  // que reaparece en el próximo login. Inicial sincrónico para no parpadear.
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  })

  if (!loaded || !user || !user.member_id) return null
  if (user.is_system || user.has_cedula || dismissed) return null

  function posponer() {
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* no-op */ }
    setDismissed(true)
  }

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-coral/25 bg-coral/5 px-4 py-3">
      <IdCard size={18} className="mt-0.5 shrink-0 text-coral-deep" aria-hidden />
      <div className="flex-1 text-sm text-navy font-body">
        <p className="font-medium">Falta tu cédula</p>
        <p className="mt-0.5 text-navy-light/80">
          Registrá tu número de cédula para completar tu perfil. Es necesario para algunos trámites
          (como la inscripción al curso prematrimonial).
        </p>
        <Link
          href={`/miembros/${user.member_id}/editar?completar=cedula`}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-coral px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-coral-deep"
        >
          <IdCard size={13} aria-hidden /> Completar cédula
        </Link>
      </div>
      <button
        onClick={posponer}
        aria-label="Posponer recordatorio"
        className="shrink-0 rounded-lg p-1 text-navy-light/50 transition-colors hover:bg-navy/5 hover:text-navy"
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  )
}
