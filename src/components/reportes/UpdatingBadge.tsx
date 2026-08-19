'use client'

import { Loader2 } from 'lucide-react'

/** Indicador flotante de "actualizando" para los reportes: aparece mientras se
 *  refetchean datos (cambio de año, sede o cohorte). Fijo abajo-derecha para que
 *  se vea sin importar el scroll y sin reacomodar el layout. aria-live para que
 *  lectores de pantalla anuncien la actualización. */
export function UpdatingBadge({ show }: { show: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 right-6 z-50 inline-flex items-center gap-1.5 rounded-full bg-navy px-3.5 py-2 text-[13px] font-body text-white shadow-[var(--shadow-lg)] transition-opacity duration-200 ${show ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
    >
      <Loader2 size={14} className="animate-spin" />
      Actualizando datos…
    </div>
  )
}
