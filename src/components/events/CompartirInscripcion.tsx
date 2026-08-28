'use client'

import { useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Copy, Check, QrCode } from 'lucide-react'
import { shareRegistrationUrl } from '@/lib/events/public-register-link'

/**
 * El link para compartir la inscripción, y su QR.
 *
 * Cuál link sale lo decide shareRegistrationUrl: si el evento tiene formulario
 * de inscripción, ES el del formulario; si no, el público del evento
 * (/calendario/<id>), que muestra el evento antes de pedir cuenta.
 *
 * La URL se arma con el origin del navegador cuando está disponible, para que en
 * un preview de Vercel se copie el link de ESE deployment y no el de producción.
 */
export function CompartirInscripcion({ eventId, registrationFormId }: {
  eventId: string
  /** events.registration_form_id. Si viene, el link compartido es el del form. */
  registrationFormId?: string | null
}) {
  const [copiado, setCopiado] = useState(false)
  const [verQr, setVerQr] = useState(false)
  const { url, kind } = shareRegistrationUrl(
    { id: eventId, registration_form_id: registrationFormId },
    typeof window !== 'undefined' ? window.location.origin : undefined,
  )

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de portapapeles (o http sin TLS): el input es seleccionable
      // a mano, así que no hace falta un error — solo no confirmar el copiado.
    }
  }

  return (
    <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-3">
      <div className="space-y-1">
        <p className="text-[11px] uppercase tracking-wider text-navy-light/80 font-display">
          Link para compartir
        </p>
        <p className="text-[13px] text-navy-light/80 font-body">
          {kind === 'formulario'
            ? 'Este evento se inscribe llenando su formulario, así que ESTE es el único link que hay que repartir. Para llenarlo hay que entrar con cuenta.'
            : 'Se puede mandar por WhatsApp, correo o QR. Muestra el evento a cualquiera; para inscribirse hay que entrar con cuenta, y al entrar la inscripción se abre sola.'}
        </p>
      </div>

      <div className="flex gap-2">
        <input
          readOnly
          value={url}
          aria-label={kind === 'formulario' ? 'Link del formulario de inscripción' : 'Link público del evento'}
          onFocus={e => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-xl bg-surface-low px-3 py-2 text-[13px] text-navy-light font-mono outline-none focus:ring-1 focus:ring-coral/30"
        />
        <button
          type="button"
          onClick={copiar}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-coral px-3.5 py-2 text-[13px] font-medium text-white hover:bg-coral-deep transition-colors font-body"
        >
          {copiado ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
        <button
          type="button"
          onClick={() => setVerQr(v => !v)}
          aria-expanded={verQr}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--outline-variant)] px-3.5 py-2 text-[13px] text-navy-light hover:bg-surface-low transition-colors font-body"
        >
          <QrCode size={14} aria-hidden="true" />
          QR
        </button>
      </div>

      {verQr && (
        <div className="flex flex-col items-center gap-2 pt-1">
          {/* Nivel de corrección M: aguanta que el QR quede algo tapado o
              impreso en baja calidad, que es lo que pasa en un flyer. */}
          <QRCodeCanvas value={url} size={168} level="M" includeMargin />
          <p className="text-[13px] text-navy-light/80 font-body">
            Clic derecho sobre el código para guardarlo como imagen.
          </p>
        </div>
      )}
    </div>
  )
}
