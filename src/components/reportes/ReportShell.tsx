'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ALL_SEDES } from '@/lib/reports/charla-attendance'

/** Normaliza para buscar sin tildes ni mayúsculas. */
function norm(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

/** Layout reutilizable de un reporte: header con volver + filtros (año en pills,
 *  sede como sidebar en desktop / selector en mobile) + área de contenido. Pensado
 *  para que cada reporte nuevo solo pase sus filtros y sus gráficos. */
export function ReportShell({
  title, description, years, year, onYear, sedes, sede, onSede, sedeCounts, totalCount, children,
}: {
  title: string
  description?: string
  years: number[]
  year: number
  onYear: (y: number) => void
  sedes: string[]
  sede: string
  onSede: (s: string) => void
  /** Conteo de check-ins por sede del año seleccionado (para mostrar al lado). */
  sedeCounts?: Record<string, number>
  /** Total general del año (para "Todas las sedes"). */
  totalCount?: number
  children: React.ReactNode
}) {
  const [sedeQuery, setSedeQuery] = useState('')
  const q = norm(sedeQuery)
  const filteredSedes = q ? sedes.filter(s => norm(s).includes(q)) : sedes
  const fmt = (n: number | undefined) => (n == null ? undefined : n.toLocaleString('es-CR'))
  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <Link href="/reportes" className="inline-flex items-center gap-1 text-[13px] text-navy-light/70 hover:text-navy transition-colors font-body">
          <ChevronLeft size={15} /> Reportes
        </Link>
        <h1 className="mt-1 text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">{title}</h1>
        {description && <p className="mt-1 text-sm text-navy-light/70 font-body">{description}</p>}
      </div>

      {/* Filtro de año (afecta todo el reporte) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {years.map(y => (
          <button
            key={y}
            onClick={() => onYear(y)}
            className={cn(
              'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium font-body transition-colors',
              y === year ? 'bg-coral text-white' : 'bg-surface-card text-navy-light/70 hover:bg-surface-low shadow-[var(--shadow-sm)]',
            )}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Selector de sede en mobile */}
      <div className="lg:hidden">
        <label className="text-[12px] tracking-widest uppercase text-navy-light/70 font-display block mb-1">Sede</label>
        <select
          value={sede}
          onChange={e => onSede(e.target.value)}
          aria-label="Filtrar por sede"
          className="w-full rounded-xl bg-surface-card px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 shadow-[var(--shadow-sm)] font-body"
        >
          <option value={ALL_SEDES}>Todas las sedes</option>
          {sedes.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-5">
        {/* Sidebar de sedes (desktop) */}
        <aside className="hidden lg:block">
          <div className="rounded-2xl bg-surface-card p-2 shadow-[var(--shadow-md)] sticky top-20">
            <p className="px-2 py-1.5 text-[12px] tracking-widest uppercase text-navy-light/70 font-display">Sedes</p>
            {/* Buscador de sedes */}
            <div className="relative mb-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-navy-light/70 pointer-events-none" />
              <input
                value={sedeQuery}
                onChange={e => setSedeQuery(e.target.value)}
                placeholder="Buscar sede…"
                aria-label="Buscar sede"
                className="w-full rounded-lg bg-surface-low pl-7 pr-2 py-1.5 text-[12px] text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
              />
            </div>
            {!q && (
              <SedeButton label="Todas las sedes" count={fmt(totalCount)} active={sede === ALL_SEDES} onClick={() => onSede(ALL_SEDES)} />
            )}
            {filteredSedes.map(s => (
              <SedeButton key={s} label={s} count={fmt(sedeCounts?.[s])} active={sede === s} onClick={() => onSede(s)} />
            ))}
            {q && filteredSedes.length === 0 && (
              <p className="px-2.5 py-2 text-[12px] text-navy-light/70 font-body">Sin coincidencias.</p>
            )}
          </div>
        </aside>

        {/* Contenido */}
        <div className="min-w-0 space-y-5">{children}</div>
      </div>
    </div>
  )
}

function SedeButton({ label, count, active, onClick }: { label: string; count?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-between gap-2 text-left rounded-xl px-2.5 py-2 text-[13px] font-body transition-colors',
        active ? 'bg-coral text-white' : 'text-navy-light/80 hover:bg-surface-low',
      )}
    >
      <span className="min-w-0 truncate">{label}</span>
      {count != null && (
        <span className={cn('text-[12px] tabular-nums shrink-0', active ? 'text-white/80' : 'text-navy-light/70')}>{count}</span>
      )}
    </button>
  )
}
