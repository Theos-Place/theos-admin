'use client'

import { useState } from 'react'
import { CalendarPlus, Copy, Check } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { linksDeSuscripcion } from '@/lib/events/ics'

/**
 * «Suscribirme al calendario» (2026-10-15).
 *
 * Reemplaza al botón que bajaba un .ics: aquello era una foto del momento y un
 * evento nuevo nunca llegaba al calendario de la persona. Esto agrega la URL
 * del feed (`/api/public/events.ics`) a su app, que la vuelve a pedir sola.
 *
 * `tipos`: el mismo filtro `?types=` del widget, para que quien se suscribe
 * desde una cartelera filtrada reciba lo mismo que está viendo.
 */
export function SuscribirseAlCalendario({ tipos, className, children }: {
  tipos?: string[] | null
  className?: string
  children?: React.ReactNode
}) {
  const [abierto, setAbierto] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [feed, setFeed] = useState('')

  const abrir = () => {
    // El origen se lee al abrir y no al renderizar: en el servidor no existe.
    const q = tipos?.length ? `?types=${encodeURIComponent(tipos.join(','))}` : ''
    setFeed(`${window.location.origin}/api/public/events.ics${q}`)
    setCopiado(false)
    setAbierto(true)
  }
  const links = feed ? linksDeSuscripcion(feed) : null

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(feed)
      setCopiado(true)
    } catch { /* sin permiso de portapapeles: el enlace queda visible para copiarlo a mano */ }
  }

  const opcion = 'flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--outline-variant)] px-4 py-3 text-left text-sm font-medium text-navy hover:bg-surface-low transition-colors font-body'

  return (
    <>
      <button type="button" onClick={abrir} className={className}>
        {children ?? (<><CalendarPlus size={14} aria-hidden="true" /> Suscribirme al calendario</>)}
      </button>
      {abierto && links && (
        <Modal onClose={() => setAbierto(false)} titleId="suscribirse-titulo" width={460}>
          <div className="p-6 space-y-4">
            <div>
              <h2 id="suscribirse-titulo" className="text-lg font-extrabold text-navy font-display">
                Agregar los eventos de Theos a tu calendario
              </h2>
              <p className="mt-1 text-[13px] text-navy-light/80 font-body">
                Te suscribís una vez y listo: los eventos nuevos, los cambios de hora y los que se
                cancelan se actualizan solos en tu calendario.
              </p>
            </div>

            <div className="space-y-2">
              <a href={links.google} target="_blank" rel="noopener noreferrer" className={opcion}>
                <span>Google Calendar</span>
                <span className="text-[13px] font-normal text-navy-light/80">se abre en el navegador</span>
              </a>
              <a href={links.webcal} target="_top" className={opcion}>
                <span>Apple (iPhone, iPad, Mac)</span>
                <span className="text-[13px] font-normal text-navy-light/80">abre Calendario</span>
              </a>
              <a href={links.outlook} target="_blank" rel="noopener noreferrer" className={opcion}>
                <span>Outlook de trabajo</span>
                <span className="text-[13px] font-normal text-navy-light/80">Microsoft 365</span>
              </a>
              <a href={links.outlookPersonal} target="_blank" rel="noopener noreferrer" className={opcion}>
                <span>Outlook personal</span>
                <span className="text-[13px] font-normal text-navy-light/80">hotmail, outlook.com</span>
              </a>
            </div>

            <div>
              <p className="form-label mb-1">Otra app: copiá este enlace</p>
              <div className="flex items-center gap-2">
                <input
                  readOnly value={feed} aria-label="Enlace del calendario"
                  onFocus={e => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-lg border border-[var(--outline-variant)] bg-surface-low px-3 py-2 text-[13px] text-navy font-body"
                />
                <button type="button" onClick={copiar}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--outline-variant)] px-3.5 py-2 text-[13px] font-medium text-navy hover:bg-surface-low transition-colors font-body">
                  {copiado ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                  {copiado ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            <ul className="list-disc space-y-1 pl-5 text-[13px] text-navy-light/80 font-body">
              <li>Google revisa los calendarios suscritos por su cuenta, cada varias horas: un evento nuevo puede tardar en aparecer y no se puede acelerar.</li>
              <li>En un Android, agregalo desde una computadora en calendar.google.com; después aparece solo en el teléfono.</li>
            </ul>
          </div>
        </Modal>
      )}
    </>
  )
}
