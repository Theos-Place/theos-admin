'use client'

import Link from 'next/link'
import { BarChart2, ChevronRight, Users, TrendingUp, type LucideIcon } from 'lucide-react'

// Catálogo de reportes disponibles. Para agregar uno nuevo: sumar una entrada acá
// y crear su página en /reportes/<slug>. El índice no necesita rediseño.
type ReportTile = { href: string; title: string; description: string; icon: LucideIcon; ready: boolean }

const REPORTS: ReportTile[] = [
  {
    href: '/reportes/asistencia',
    title: 'Crecimiento y Asistencia',
    description: 'Personas nuevas por sede y mes, y asistencia a charlas por sede/semana con comparativos por año.',
    icon: BarChart2,
    ready: true,
  },
  {
    href: '/reportes/discipulos',
    title: 'Discípulos Multiplicadores',
    description: 'Personas que asisten comprometidas, sirven y donan. Traslape de criterios, tiempo a hitos y foto por cohorte.',
    icon: Users,
    ready: true,
  },
  {
    href: '/reportes/retencion',
    title: 'Retención y Transición',
    description: 'Asistentes por grupo etario, retención año a año, flujo al cambiar de grupo (transición/dropout) y proyección a 2030.',
    icon: TrendingUp,
    ready: true,
  },
]

export default function ReportesIndexPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">Reportes</h1>
        <p className="mt-1 text-sm text-navy-light/70 font-body">
          Reportes analíticos del sistema en vivo. Reemplazan los tableros externos.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.filter(r => r.ready).map(r => {
          const Icon = r.icon
          return (
            <Link
              key={r.href}
              href={r.href}
              className="group rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] hover:bg-surface-low transition-colors flex flex-col"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="h-11 w-11 rounded-xl bg-coral/10 flex items-center justify-center shrink-0">
                  <Icon size={20} className="text-coral" />
                </div>
                <ChevronRight size={18} className="text-navy-light/40 group-hover:text-navy-light/70 transition-colors mt-1" />
              </div>
              <h2 className="mt-3 text-base font-bold text-navy font-display">{r.title}</h2>
              <p className="mt-1 text-[13px] text-navy-light/70 font-body leading-relaxed">{r.description}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
