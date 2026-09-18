'use client'

import { useEffect, useState } from 'react'
import { History, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fechaCR } from '@/lib/fecha-cr'
import { SIN_ACTOR, SIN_DETALLE, type EntradaDeHistorial } from '@/lib/audit/historial'
import type { EntidadAuditable } from '@/lib/audit/entidades'

/**
 * AUD-2 · "¿Quién tocó esto y cuándo?", sin escribir un script.
 *
 * Nació de una pregunta concreta: quién había movido a Pamela Fonseca entre dos
 * grupos de SCJ. El dato estaba en `audit_log` desde siempre y no había ninguna
 * pantalla donde verlo.
 *
 * Carga PEREZOSA: el historial solo se pide cuando alguien abre el panel. Es
 * una consulta más en una pantalla que ya hace varias, y la mayoría de las
 * veces nadie lo va a abrir.
 */
export function HistorialPanel({
  entityType, entityId, titulo = 'Historial de cambios', inicialmenteAbierto = false,
}: {
  entityType: EntidadAuditable
  entityId: string
  titulo?: string
  /** Para cuando el panel YA es el resultado de un clic (una fila que se
   *  desplegó): pedir dos clics para lo mismo no tiene sentido. */
  inicialmenteAbierto?: boolean
}) {
  const [abierto, setAbierto] = useState(inicialmenteAbierto)
  const [items, setItems] = useState<EntradaDeHistorial[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!abierto || items || error) return
    let vivo = true
    fetch(`/api/audit/${entityType}/${entityId}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(d => { if (vivo) setItems(d.items ?? []) })
      .catch(() => { if (vivo) setError(true) })
    return () => { vivo = false }
  }, [abierto, items, error, entityType, entityId])

  return (
    <section className="rounded-2xl bg-surface-card shadow-[var(--shadow-sm)] overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        aria-expanded={abierto}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-surface-low transition-colors"
      >
        <span className="flex items-center gap-2.5">
          <History size={16} className="text-navy-light/80" aria-hidden />
          <span className="text-sm font-semibold text-navy font-body">{titulo}</span>
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={cn('text-navy-light/80 transition-transform', abierto && 'rotate-180')}
        />
      </button>

      {abierto && (
        <div className="px-5 pb-5">
          {error ? (
            <p className="text-[13px] text-navy-light/80 font-body">No se pudo cargar el historial.</p>
          ) : !items ? (
            <p className="text-[13px] text-navy-light/80 font-body" role="status">Cargando…</p>
          ) : items.length === 0 ? (
            <p className="text-[13px] text-navy-light/80 font-body">No hay cambios registrados.</p>
          ) : (
            <ol className="space-y-3">
              {items.map(e => (
                <li key={e.id} className="border-l-2 border-[var(--outline-variant)] pl-3">
                  <p className="text-[13px] text-navy font-body">
                    <span className="font-semibold">{e.quien ?? SIN_ACTOR}</span>
                    {' · '}{e.queHizo}
                  </p>
                  <p className="text-[11px] uppercase tracking-wide text-navy-light/80 font-body">
                    {fechaCR(e.cuando, 'corta')} · {new Date(e.cuando).toLocaleTimeString('es-CR', {
                      hour: 'numeric', minute: '2-digit', timeZone: 'America/Costa_Rica',
                    })}
                  </p>
                  {e.sinDetalle ? (
                    <p className="mt-1 text-[13px] text-navy-light/80 font-body">{SIN_DETALLE}</p>
                  ) : (
                    <ul className="mt-1 space-y-0.5">
                      {e.cambios.map(c => (
                        <li key={c.campo} className="text-[13px] text-navy-light/80 font-body">
                          <span className="text-navy">{c.etiqueta}</span>{': '}
                          {/* Una cadena vacía es "no aplica": en una creación no
                              hay antes y en un borrado no hay después. */}
                          {c.antes && <><span className="line-through">{c.antes}</span>{' → '}</>}
                          {c.despues || <span className="italic">se quitó</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  )
}
