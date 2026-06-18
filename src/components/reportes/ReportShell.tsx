'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ALL_SEDES } from '@/lib/reports/charla-attendance'

/** Layout reutilizable de un reporte: header con volver + filtros (año en pills,
 *  sede como sidebar en desktop / selector en mobile) + área de contenido. Pensado
 *  para que cada reporte nuevo solo pase sus filtros y sus gráficos. */
export function ReportShell({
  title, description, years, year, onYear, sedes, sede, onSede, children,
}: {
  title: string
  description?: string
  years: number[]
  year: number
  onYear: (y: number) => void
  sedes: string[]
  sede: string
  onSede: (s: string) => void
  children: React.ReactNode
}) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <Link href="/reportes" className="inline-flex items-center gap-1 text-[13px] text-navy-light/60 hover:text-navy transition-colors font-body">
          <ChevronLeft size={15} /> Reportes
        </Link>
        <h1 className="mt-1 text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">{title}</h1>
        {description && <p className="mt-1 text-sm text-navy-light/60 font-body">{description}</p>}
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
        <label className="text-[11px] tracking-widest uppercase text-navy-light/60 font-display block mb-1">Sede</label>
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
            <p className="px-2 py-1.5 text-[11px] tracking-widest uppercase text-navy-light/60 font-display">Sedes</p>
            <SedeButton label="Todas las sedes" active={sede === ALL_SEDES} onClick={() => onSede(ALL_SEDES)} />
            {sedes.map(s => (
              <SedeButton key={s} label={s} active={sede === s} onClick={() => onSede(s)} />
            ))}
          </div>
        </aside>

        {/* Contenido */}
        <div className="min-w-0 space-y-5">{children}</div>
      </div>
    </div>
  )
}

function SedeButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-xl px-2.5 py-2 text-[13px] font-body transition-colors',
        active ? 'bg-coral text-white' : 'text-navy-light/80 hover:bg-surface-low',
      )}
    >
      {label}
    </button>
  )
}
