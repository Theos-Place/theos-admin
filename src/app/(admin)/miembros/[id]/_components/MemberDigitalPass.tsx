'use client'

import { useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Modal } from '@/components/shared/Modal'
import { Download, Maximize2, Wallet } from 'lucide-react'
import type { Member } from '@/types/member'

/** Pase digital del miembro: QR que codifica su member_id (UUID). El miembro lo
 *  muestra desde el teléfono en la entrada de eventos. */
export function MemberDigitalPass({ member }: { member: Member }) {
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(false)
  const fullName = `${member.first_name} ${member.last_name}`.trim()

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
      <h3 className="text-sm font-medium text-navy mb-4 font-display font-extrabold">Pase digital</h3>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-5">
        {/* QR */}
        <div ref={canvasWrapRef} className="rounded-2xl bg-white p-3 shadow-[var(--shadow-md)] shrink-0">
          <QRCodeCanvas value={member.id} size={132} level="M" marginSize={1} />
        </div>

        <div className="flex-1 min-w-0 w-full space-y-3">
          <p className="text-[13px] text-navy-light/70 font-body text-center sm:text-left">
            Mostrá este código en la entrada del evento para tu check-in.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              onClick={downloadPNG}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-coral px-4 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body min-h-[44px]"
            >
              <Download size={15} /> Descargar QR
            </button>
            <button
              onClick={() => setZoom(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body min-h-[44px]"
            >
              <Maximize2 size={15} /> Ver en grande
            </button>
          </div>

          {/* Placeholder Wallet (Apple / Google) — pendiente de credenciales */}
          <div className="flex items-center gap-2 rounded-xl bg-surface-low px-3 py-2.5 text-[12px] text-navy-light/60 font-body">
            <Wallet size={14} className="shrink-0" />
            Próximamente: agregar a Apple Wallet / Google Wallet
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
              <QRCodeCanvas value={member.id} size={260} level="M" marginSize={1} />
            </div>
            <p className="text-[12px] text-navy-light/60 font-body text-center">Acercá la pantalla al lector en la entrada.</p>
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
