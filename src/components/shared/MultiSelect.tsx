'use client'

import { useState, useEffect, useRef, useMemo, useId } from 'react'
import { ChevronDown, Check, X, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { filtrarOpciones, etiquetaSeleccion, alternar, type OpcionMulti } from '@/lib/multi-select'

/**
 * Selector de 0..n opciones.
 *
 * Nace del filtro de tipo de estudio del buscador de grupos, donde un `<select>`
 * de una sola opción obligaba a filtrar de a un tipo por vez sobre un catálogo
 * de ~34. Queda genérico porque el mismo problema lo tienen zona y día.
 *
 * Decisiones:
 *  · Cero escogidos = "todos". No es lo mismo que "ninguno": un filtro vacío no
 *    esconde nada, y así se puede limpiar sin un botón especial.
 *  · Buscador arriba cuando hay más de 8 opciones — bajar 34 renglones a ciegas
 *    es peor que escribir tres letras.
 *  · Con UNA escogida el botón dice cuál es; con varias, cuántas. "3 tipos"
 *    obliga a abrir el menú para saber qué está filtrando.
 *  · Escape cierra y devuelve el foco al botón. Sin eso, quien navega con
 *    teclado queda con el foco en un menú que ya no está.
 */
export function MultiSelect({
  opciones,
  seleccionados,
  onChange,
  vacio = 'Todos',
  sustantivo = 'opciones',
  ariaLabel,
  buscarPlaceholder = 'Buscar…',
  className,
}: {
  opciones: readonly OpcionMulti[]
  seleccionados: readonly string[]
  onChange: (v: string[]) => void
  /** Qué dice el botón con cero escogidos. */
  vacio?: string
  /** Para contar de dos en adelante: "3 tipos". */
  sustantivo?: string
  ariaLabel: string
  buscarPlaceholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const caja = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const buscador = useRef<HTMLInputElement>(null)
  const listaId = useId()

  const conBuscador = opciones.length > 8
  const visibles = useMemo(() => filtrarOpciones(opciones, query), [opciones, query])
  const etiqueta = etiquetaSeleccion({ seleccionados, opciones, vacio, sustantivo })

  // Clic afuera cierra. Se registra solo mientras está abierto.
  useEffect(() => {
    if (!open) return
    function fuera(e: MouseEvent) {
      if (caja.current && !caja.current.contains(e.target as Node)) alternarAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [open])

  // Al abrir, el foco va al buscador si lo hay.
  useEffect(() => {
    if (open) buscador.current?.focus()
  }, [open])

  /** Abrir/cerrar. La búsqueda se limpia ACÁ y no en un effect: hacerlo en el
   *  effect es un setState sincrónico que encadena renders (react-hooks lo
   *  marca). Se limpia siempre que se cierra, porque reabrir con un filtro
   *  viejo puesto hace creer que faltan opciones. */
  function alternarAbierto(v: boolean) {
    setOpen(v)
    if (!v) setQuery('')
  }

  function cerrarYVolver() {
    alternarAbierto(false)
    boton.current?.focus()
  }

  return (
    <div className={cn('relative', className)} ref={caja}>
      <button
        ref={boton}
        type="button"
        onClick={() => alternarAbierto(!open)}
        onKeyDown={e => { if (e.key === 'Escape' && open) { e.stopPropagation(); cerrarYVolver() } }}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listaId : undefined}
        className={cn(
          'w-full inline-flex items-center justify-between gap-2 rounded-xl bg-surface-low px-3 py-2',
          'text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body text-left',
        )}
      >
        <span className={cn('truncate', seleccionados.length === 0 && 'text-navy-light/80')}>
          {etiqueta}
        </span>
        <span className="inline-flex items-center gap-1 shrink-0">
          {seleccionados.length > 1 && (
            <span className="rounded-full bg-coral/10 px-1.5 text-[11px] font-semibold text-coral-deep font-display tabular-nums">
              {seleccionados.length}
            </span>
          )}
          <ChevronDown
            size={14}
            className={cn('text-navy-light/80 transition-transform', open && 'rotate-180')}
            aria-hidden
          />
        </span>
      </button>

      {open && (
        <div
          className="absolute left-0 top-[calc(100%+6px)] z-40 w-full min-w-[240px] rounded-2xl overflow-hidden bg-surface-card shadow-[0_20px_48px_rgba(22,20,64,0.14)] border border-[var(--outline-variant)]"
          onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); cerrarYVolver() } }}
        >
          {conBuscador && (
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--outline-variant)]">
              <Search size={13} className="text-navy-light/80 shrink-0" aria-hidden />
              <input
                ref={buscador}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={buscarPlaceholder}
                aria-label={`Buscar dentro de ${ariaLabel.toLowerCase()}`}
                className="w-full bg-transparent text-sm text-navy outline-none font-body placeholder:text-navy-light/80"
              />
            </div>
          )}

          {seleccionados.length > 0 && (
            <div className="px-3 py-2 border-b border-[var(--outline-variant)]">
              <button
                type="button"
                onClick={() => onChange([])}
                className="inline-flex items-center gap-1 text-[13px] text-navy-light/80 hover:text-navy transition-colors font-body"
              >
                <X size={12} aria-hidden /> Quitar la selección ({seleccionados.length})
              </button>
            </div>
          )}

          <div id={listaId} role="listbox" aria-multiselectable className="py-1.5 max-h-72 overflow-y-auto">
            {visibles.length === 0 ? (
              <p className="px-3.5 py-3 text-[13px] text-navy-light/80 font-body">
                Nada calza con “{query}”.
              </p>
            ) : visibles.map(o => {
              const marcada = seleccionados.includes(o.value)
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={marcada}
                  onClick={() => onChange(alternar(seleccionados, o.value))}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-left transition-colors font-body',
                    marcada ? 'bg-coral/5 text-navy' : 'text-navy hover:bg-surface-low',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                      marcada ? 'bg-coral border-coral' : 'border-navy/20',
                    )}
                    aria-hidden
                  >
                    {marcada && <Check size={11} className="text-white" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1">{o.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
