'use client'

import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DatePicker } from '@/components/events/DatePicker'
import {
  GRUPO_FILTRO, ETIQUETA_FILTRO, CAMPO, CAMPO_FECHA, BOTON_SECUNDARIO,
} from '@/components/finance/reporte-ui'

/**
 * Las piezas de la barra de los reportes de finanzas (pedido de Floriana,
 * 2026-10-19: «el mismo layout de los otros con el desde hasta»): el rango de
 * fechas, la búsqueda y un filtro con su rótulo al lado.
 */
export function RangoDeFechas({ id, etiqueta, desde, hasta, onDesde, onHasta }: {
  id: string
  /** «Creado desde», «Solicitada desde»… — qué fecha filtra. */
  etiqueta: string
  desde: string
  hasta: string
  onDesde: (v: string) => void
  onHasta: (v: string) => void
}) {
  return (
    <>
      <label htmlFor={`${id}-desde`} className={GRUPO_FILTRO}>
        <span className={ETIQUETA_FILTRO}>{etiqueta}</span>
        <DatePicker id={`${id}-desde`} value={desde} max={hasta || undefined} onChange={v => onDesde(v)} className={CAMPO_FECHA} />
      </label>
      <label htmlFor={`${id}-hasta`} className={GRUPO_FILTRO}>
        <span className={ETIQUETA_FILTRO}>Hasta</span>
        <DatePicker id={`${id}-hasta`} value={hasta} min={desde || undefined} onChange={v => onHasta(v)} className={CAMPO_FECHA} />
      </label>
      {(desde || hasta) && (
        <button type="button" onClick={() => { onDesde(''); onHasta('') }} className={BOTON_SECUNDARIO}>Limpiar</button>
      )}
    </>
  )
}

export function Buscador({ valor, onCambio, placeholder }: { valor: string; onCambio: (v: string) => void; placeholder: string }) {
  return (
    <div className={cn('focus-within:ring-1 focus-within:ring-coral/30 flex flex-1 min-w-48 items-center gap-2', CAMPO)}>
      <Search size={14} className="text-navy-light/80 shrink-0" aria-hidden="true" />
      <input type="search" value={valor} onChange={e => onCambio(e.target.value)} placeholder={placeholder} aria-label={placeholder.replace(/…|\.\.\.$/, '')}
        className="flex-1 bg-transparent text-[13px] outline-none font-body text-navy" />
    </div>
  )
}

export function SelectRotulado({ id, etiqueta, valor, onCambio, opciones }: {
  id: string
  etiqueta: string
  valor: string
  onCambio: (v: string) => void
  opciones: ReadonlyArray<{ value: string; label: string }>
}) {
  return (
    <div className={GRUPO_FILTRO}>
      <label htmlFor={id} className={ETIQUETA_FILTRO}>{etiqueta}</label>
      <select id={id} value={valor} onChange={e => onCambio(e.target.value)} className={`${CAMPO} max-w-[200px]`}>
        {opciones.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
