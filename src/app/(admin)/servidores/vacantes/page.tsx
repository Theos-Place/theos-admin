'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { type VacancyStatus } from '@/data/mock-servers'
import { useServers } from '@/hooks/useServers'
import { useOrg } from '@/lib/org'
import { cn } from '@/lib/utils'
import { Plus, Users, ChevronRight } from 'lucide-react'

const STATUS_FILTERS: { key: VacancyStatus | 'all'; label: string }[] = [
  { key: 'all',       label: 'Todas' },
  { key: 'published', label: 'Publicadas' },
  { key: 'draft',     label: 'Borrador' },
  { key: 'filled',    label: 'Ocupadas' },
  { key: 'closed',    label: 'Cerradas' },
]

const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-navy-light/10 text-navy-light/50',
  published: 'bg-teal-deep/10 text-teal-deep',
  filled:    'bg-navy/10 text-navy',
  closed:    'bg-coral/10 text-coral',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', published: 'Publicada', filled: 'Ocupada', closed: 'Cerrada',
}

export default function VacantesPage() {
  const { vacancies: MOCK_VACANCIES, applications: MOCK_APPLICATIONS } = useServers()
  const { areas: AREAS } = useOrg()
  const [statusFilter, setStatusFilter] = useState<VacancyStatus | 'all'>('all')
  const [areaFilter, setAreaFilter] = useState('all')

  const published = MOCK_VACANCIES.filter(v => v.status === 'published').length
  const draft     = MOCK_VACANCIES.filter(v => v.status === 'draft').length
  const filled    = MOCK_VACANCIES.filter(v => v.status === 'filled').length

  const filtered = useMemo(() => {
    return MOCK_VACANCIES.filter(v => {
      const matchStatus = statusFilter === 'all' || v.status === statusFilter
      const matchArea   = areaFilter === 'all' || v.area === areaFilter
      return matchStatus && matchArea
    })
  }, [statusFilter, areaFilter])

  const appCountByVacancy = useMemo(() => {
    const map: Record<string, number> = {}
    MOCK_APPLICATIONS.forEach(a => {
      map[a.vacancy_id] = (map[a.vacancy_id] ?? 0) + 1
    })
    return map
  }, [])

  const areaOptions = [
    { key: 'all', label: 'Todas las áreas' },
    ...AREAS.map(a => ({ key: a.name, label: a.name })),
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className="rounded-2xl bg-navy px-6 py-5 flex items-start justify-between gap-4"
        style={{ boxShadow: 'var(--shadow-md)' }}
      >
        <div>
          <h1
            className="text-2xl text-white"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            Vacantes
          </h1>
          <p className="mt-1 text-sm text-white/50" style={{ fontFamily: 'var(--font-body)' }}>
            {published} publicadas · {draft} en borrador · {filled} ocupadas
          </p>
        </div>
        <Link
          href="/servidores/vacantes/nueva"
          className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-all duration-150 shrink-0"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          <Plus size={14} />
          Nueva vacante
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-[12px] font-medium border transition-all duration-150',
                statusFilter === f.key
                  ? 'bg-navy text-white border-navy'
                  : 'text-navy-light/60 hover:text-navy hover:bg-surface-low border-transparent'
              )}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          className="rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30"
          style={{ fontFamily: 'var(--font-body)' }}
          value={areaFilter}
          onChange={e => setAreaFilter(e.target.value)}
        >
          {areaOptions.map(o => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Vacancy cards */}
      <div className="space-y-3">
        {filtered.map(v => {
          const appCount = appCountByVacancy[v.id] ?? 0
          const slotsLeft = v.slots_total - v.slots_filled
          return (
            <div
              key={v.id}
              className="rounded-2xl px-5 py-4 space-y-3"
              style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <p
                    className="text-base font-bold text-navy"
                    style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}
                  >
                    {v.title}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-semibold text-navy-light/60"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {v.committee_name}
                    </span>
                    <span
                      className="rounded-full bg-surface-low px-2 py-0.5 text-[10px] text-navy-light/50"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {v.area}
                    </span>
                    <span
                      className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', STATUS_COLORS[v.status])}
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {STATUS_LABELS[v.status]}
                    </span>
                  </div>
                </div>
              </div>

              <p
                className="text-[13px] text-navy-light/70 line-clamp-2"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {v.description}
              </p>

              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-[12px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
                  📅 {v.schedule}
                </span>
                <span className="text-[12px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
                  ⏱ {v.commitment}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: 'var(--outline-variant)' }}>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <Users size={13} className="text-navy-light/40" />
                    <span className="text-[12px] text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
                      {appCount} aplicacion{appCount !== 1 ? 'es' : ''}
                    </span>
                  </div>
                  <span className="text-[12px] text-navy-light/50" style={{ fontFamily: 'var(--font-mono)' }}>
                    {slotsLeft} cupo{slotsLeft !== 1 ? 's' : ''} disponible{slotsLeft !== 1 ? 's' : ''}
                  </span>
                  {v.published_at && (
                    <span className="text-[11px] text-navy-light/30" style={{ fontFamily: 'var(--font-body)' }}>
                      Publicada {new Date(v.published_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/servidores/vacantes/${v.id}`}
                    className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
                    style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                  >
                    Ver aplicaciones
                    <ChevronRight size={12} />
                  </Link>
                  <button
                    className="rounded-full border px-3 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
                    style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                  >
                    Editar
                  </button>
                  {v.status === 'published' && (
                    <button
                      className="rounded-full border px-3 py-1.5 text-[12px] text-coral hover:bg-coral/5 transition-colors"
                      style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                    >
                      Cerrar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div
            className="rounded-2xl px-5 py-12 text-center"
            style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
          >
            <p className="text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
              No hay vacantes con ese filtro.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
