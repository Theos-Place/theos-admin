'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { STUDY_TYPES, MOCK_GROUPS } from '@/data/mock-studies'
import { StudyTypeBadge } from '@/components/studies/StudyTypeBadge'
import { GroupStatusBadge } from '@/components/studies/GroupStatusBadge'
import { CommitmentIcons } from '@/components/studies/CommitmentIcons'
import { sedeLabel } from '@/data/mock-sedes'
import { ChevronLeft, Archive, Edit3, Search, X } from 'lucide-react'

const PAGE_SIZE = 10

const inputCls = 'rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

function formatCost(cost: number) {
  if (cost === 0) return 'Gratis'
  return `₡${cost.toLocaleString('es-CR')}`
}

function ConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy-ink/50 backdrop-blur-sm" onClick={onCancel} />
      <div
        className="relative rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4"
        style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-lg)' }}
      >
        <div className="flex items-center gap-3">
          <Archive size={20} className="text-coral" />
          <h3 className="font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
            Archivar estudio
          </h3>
        </div>
        <p className="text-sm text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
          Al archivar este tipo de estudio no podrás crear nuevos grupos con él. Los grupos existentes no se ven afectados.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Sí, archivar
          </button>
          <button
            onClick={onCancel}
            className="rounded-xl border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PlanDeEstudioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const study = STUDY_TYPES.find(s => s.id === id)

  const [showArchive, setShowArchive] = useState(false)
  const [archived, setArchived] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [zoneFilter, setZoneFilter] = useState<string>('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const studyGroups = MOCK_GROUPS.filter(g => g.study_type_id === id)

  const filteredGroups = studyGroups.filter(g => {
    const matchSearch = !search.trim() ||
      g.leader_name?.toLowerCase().includes(search.toLowerCase()) ||
      g.zone?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || g.status === statusFilter
    const matchZone = zoneFilter === 'all' || g.zone === zoneFilter
    return matchSearch && matchStatus && matchZone
  })

  const visibleGroups = filteredGroups.slice(0, visibleCount)
  const hasMore = visibleCount < filteredGroups.length
  const remaining = filteredGroups.length - visibleCount

  const uniqueZones = Array.from(new Set(studyGroups.map(g => g.zone).filter(Boolean))) as string[]

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [search, statusFilter, zoneFilter])

  if (!study) {
    return (
      <div className="space-y-4">
        <Link href="/estudios/plan" className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy">
          <ChevronLeft size={16} /> Volver
        </Link>
        <p className="text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
          Tipo de estudio no encontrado.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      {showArchive && (
        <ConfirmModal
          onConfirm={() => { setArchived(true); setShowArchive(false) }}
          onCancel={() => setShowArchive(false)}
        />
      )}

      {/* Back link */}
      <div>
        <Link
          href="/estudios/plan"
          className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          <ChevronLeft size={16} />
          Plan de Estudios
        </Link>
      </div>

      {/* Study title + actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <StudyTypeBadge code={study.code} size="md" />
          <div>
            <h1
              className="text-2xl text-navy"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}
            >
              {study.name}
            </h1>
            <p className="text-sm text-navy-light/60 capitalize" style={{ fontFamily: 'var(--font-body)' }}>
              Etapa: {study.stage === 'niveles' ? 'Niveles' : study.stage === 'inicial' ? 'Inicial' : study.stage === 'campaña' ? 'Campaña' : 'Intermedia'}
              {archived && <span className="ml-2 text-amber-600 text-[11px] font-medium">[ARCHIVADO]</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => router.push(`/estudios/plan/${study.code}/editar`)}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            <Edit3 size={14} />
            Editar
          </button>
          {!archived && (
            <button
              onClick={() => setShowArchive(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
            >
              <Archive size={14} />
              Archivar
            </button>
          )}
        </div>
      </div>

      {/* Config card */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <h2 className="text-[10px] tracking-widest uppercase text-navy-light/40 mb-4" style={{ fontFamily: 'var(--font-display)' }}>
          Configuración
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Código',                value: study.code },
            { label: 'Semanas',               value: `${study.weeks} semanas` },
            { label: 'Costo',                 value: formatCost(study.cost) },
            { label: 'Prerrequisito',         value: study.prerequisite ?? 'Ninguno' },
            { label: 'Próximo estudio',       value: study.next_study_id ?? '—' },
            { label: 'Calificación',          value: study.requires_grade ? 'Sí' : 'No' },
            { label: 'Pago',                  value: study.requires_payment ? 'Requerido' : 'Gratuito' },
            { label: 'Transición automática', value: study.auto_promote ? 'Sí' : 'No' },
          ].map(({ label, value }) => (
            <div key={label} className="space-y-0.5">
              <p className="text-[10px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                {label}
              </p>
              <p className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--outline-variant)' }}>
          <p className="text-[10px] tracking-widest uppercase text-navy-light/40 mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            Compromisos requeridos
          </p>
          <CommitmentIcons donor={study.req_donor} server={study.req_server} charlas={study.req_attendee} size={16} />
        </div>
      </div>

      {/* Groups section */}
      <div>
        {/* Section header */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
            Grupos con este tipo de estudio ({filteredGroups.length}{filteredGroups.length !== studyGroups.length ? ` de ${studyGroups.length}` : ''})
          </h2>
          <button
            onClick={() => router.push('/estudios/grupos/nuevo')}
            className="rounded-full bg-coral px-3 py-1.5 text-sm text-white hover:bg-coral-deep transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            + Nuevo grupo
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-light/40 pointer-events-none" />
            <input
              className={inputCls}
              style={{ fontFamily: 'var(--font-body)', paddingLeft: 32, minWidth: 200 }}
              placeholder="Buscar por dirigente o zona..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-navy-light/40 hover:text-navy-light transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <select
            className={inputCls}
            style={{ fontFamily: 'var(--font-body)' }}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">Todos los estados</option>
            <option value="open">Abierto</option>
            <option value="in_progress">En curso</option>
            <option value="pending_leader">Pendiente dirigente</option>
            <option value="pending_opening">Pendiente apertura</option>
            <option value="finished">Finalizado</option>
          </select>

          <select
            className={inputCls}
            style={{ fontFamily: 'var(--font-body)' }}
            value={zoneFilter}
            onChange={e => setZoneFilter(e.target.value)}
          >
            <option value="all">Todas las zonas</option>
            {uniqueZones.map(zone => (
              <option key={zone} value={zone}>{sedeLabel(zone)}</option>
            ))}
          </select>
        </div>

        {/* Table or empty state */}
        {filteredGroups.length === 0 ? (
          <div
            className="rounded-2xl px-5 py-10 text-center"
            style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
          >
            <p className="text-sm font-semibold text-navy-light/50" style={{ fontFamily: 'var(--font-display)' }}>
              Sin resultados
            </p>
            <p className="text-xs text-navy-light/40 mt-1" style={{ fontFamily: 'var(--font-body)' }}>
              Probá con otros filtros
            </p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--outline-variant)' }}>
                    {['Dirigente', 'Zona', 'Horario', 'Participantes', 'Estado', 'Semana', ''].map(h => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[10px] tracking-widest uppercase text-navy-light/50"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleGroups.map(group => (
                    <tr
                      key={group.id}
                      className="hover:bg-surface-low transition-colors cursor-pointer"
                      style={{ borderBottom: '1px solid var(--outline-variant)' }}
                      onClick={() => router.push(`/estudios/grupos/${group.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="shrink-0 rounded-full flex items-center justify-center text-[10px] font-semibold text-white"
                            style={{ width: 28, height: 28, background: 'var(--brand-navy)' }}
                          >
                            {group.leader_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? '?'}
                          </div>
                          <span className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                            {group.leader_name ?? <span className="text-amber-600 text-[11px]">Sin asignar</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                        {sedeLabel(group.zone)}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
                        {group.schedule_days.join('/')} {group.schedule_time}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="rounded-full overflow-hidden" style={{ width: 60, height: 5, background: 'var(--outline-variant)' }}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${(group.participants.filter((p: { status: string }) => p.status !== 'withdrawn').length / group.max_capacity) * 100}%`,
                                background: 'var(--brand-coral)',
                              }}
                            />
                          </div>
                          <span className="text-[12px] text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                            {group.participants.filter((p: { status: string }) => p.status !== 'withdrawn').length}/{group.max_capacity}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <GroupStatusBadge status={group.status} />
                      </td>
                      <td className="px-4 py-3 text-[12px] text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
                        {group.status === 'in_progress' ? `Sem. ${group.current_week}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          className="rounded-lg border px-2.5 py-1 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
                          style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                          onClick={e => { e.stopPropagation(); router.push(`/estudios/grupos/${group.id}`) }}
                        >
                          Ver →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderTop: '1px solid var(--outline-variant)' }}
              >
                <span className="text-[12px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
                  Mostrando {visibleCount} de {filteredGroups.length} grupos
                </span>
                <div className="flex gap-2">
                  <button
                    className="rounded-lg border px-3 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
                    style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                    onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
                  >
                    Cargar {Math.min(PAGE_SIZE, remaining)} más
                  </button>
                  <button
                    className="rounded-lg border px-3 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
                    style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                    onClick={() => setVisibleCount(filteredGroups.length)}
                  >
                    Ver todos ({filteredGroups.length})
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
