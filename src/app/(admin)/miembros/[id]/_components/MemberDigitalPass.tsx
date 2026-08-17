'use client'

import { useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Modal } from '@/components/shared/Modal'
import { Download, Maximize2, MessageCircle, Apple, Smartphone } from 'lucide-react'
import type { Member } from '@/types/member'

/** Pase digital unificado del miembro: tarjeta navy "Theos PLACE" con el QR
 *  funcional que codifica su member_id (UUID). El QR se genera al vuelo desde el
 *  member_id (sin paso de "generar"); el miembro lo muestra desde el teléfono en
 *  la entrada de eventos. Navy oscuro (#161440) sobre blanco → alto contraste,
 *  escaneable por el lector de check-in. */
export function MemberDigitalPass({ member }: { member: Member }) {
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(false)
  const fullName = `${member.first_name} ${member.last_name}`.trim()

  // wa.me requiere el número sin signos; deja solo dígitos.
  const waPhone = (member.phone ?? '').replace(/\D/g, '')
  const waHref = waPhone
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(`Hola ${member.first_name}, aquí está tu pase digital de Theos Place.`)}`
    : null

  function downloadPNG() {
    const canvas = canvasWrapRef.current?.querySelector('canvas')
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = url
    link.download = `pase-${fullName.replace(/\s+/g, '-').toLowerCase() || member.id}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]">
      <h3 className="text-sm text-navy mb-4 font-display font-extrabold">Pase digital</h3>

      <div className="flex flex-col items-center gap-5">
        {/* Tarjeta navy "Theos PLACE" con el QR funcional dentro */}
        <div className="w-full max-w-xs rounded-2xl bg-navy p-6 shadow-[var(--shadow-md)]">
          <div className="flex items-baseline gap-0.5 mb-4">
            <span className="text-lg text-white font-display font-extrabold">Theos</span>
            <span className="text-lg text-coral font-display font-extrabold">PLACE</span>
          </div>

          {member.cedula && (
            <p className="text-xs text-white/70 mb-1 font-mono">#{member.cedula}</p>
          )}
          <p className="text-white text-lg leading-tight font-display font-extrabold">{member.first_name}</p>
          <p className="text-white/70 text-sm mb-5 font-display font-extrabold">{member.last_name}</p>

          {/* QR funcional: member_id, navy sobre blanco para máximo contraste */}
          <div ref={canvasWrapRef} className="rounded-xl bg-white p-3 w-fit shadow-[var(--shadow-md)]">
            <QRCodeCanvas value={member.id} size={148} level="M" marginSize={1} fgColor="#161440" bgColor="#ffffff" />
          </div>
        </div>

        <div className="w-full max-w-xs space-y-3">
          <p className="text-[13px] text-navy-light/70 font-body text-center">
            Mostrá este código en la entrada del evento para tu check-in.
          </p>

          {/* Acciones */}
          <div className="flex flex-col gap-2">
            <button
              onClick={downloadPNG}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-coral px-4 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body min-h-[44px]"
            >
              <Download size={15} aria-hidden /> Descargar pase
            </button>
            <button
              onClick={() => setZoom(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body min-h-[44px]"
            >
              <Maximize2 size={15} aria-hidden /> Ver en grande
            </button>
            {waHref ? (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body min-h-[44px]"
              >
                <MessageCircle size={15} aria-hidden /> Reenviar por WhatsApp
              </a>
            ) : (
              <span
                title="El miembro no tiene teléfono registrado"
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light/40 cursor-not-allowed font-body min-h-[44px]"
              >
                <MessageCircle size={15} aria-hidden /> Reenviar por WhatsApp
              </span>
            )}
          </div>

          {/* Wallets — estructura lista, deshabilitada hasta configurar credenciales */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              disabled
              title="Próximamente"
              aria-label="Agregar a Apple Wallet (próximamente)"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light/40 cursor-not-allowed font-body"
            >
              <Apple size={15} aria-hidden /> Agregar a Apple Wallet
              <span className="text-[11px] uppercase tracking-wide bg-surface-low text-navy-light/70 rounded-full px-1.5 py-0.5">Próximamente</span>
            </button>
            <button
              type="button"
              disabled
              title="Próximamente"
              aria-label="Agregar a Google Wallet (próximamente)"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light/40 cursor-not-allowed font-body"
            >
              <Smartphone size={15} aria-hidden /> Agregar a Google Wallet
              <span className="text-[11px] uppercase tracking-wide bg-surface-low text-navy-light/70 rounded-full px-1.5 py-0.5">Próximamente</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal a pantalla amplia */}
      {zoom && (
        <Modal onClose={() => setZoom(false)} titleId="pase-qr-title" width={360}>
          <div className="p-6 flex flex-col items-center gap-4">
            <h2 id="pase-qr-title" className="text-base font-display font-extrabold text-navy text-center">
              {fullName || 'Pase digital'}
            </h2>
            <div className="rounded-2xl bg-white p-4 shadow-[var(--shadow-md)]">
              <QRCodeCanvas value={member.id} size={260} level="M" marginSize={1} fgColor="#161440" bgColor="#ffffff" />
            </div>
            <p className="text-[12px] text-navy-light/70 font-body text-center">Acercá la pantalla al lector en la entrada.</p>
            <button
              onClick={() => setZoom(false)}
              className="rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body min-h-[44px]"
            >
              Cerrar
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
