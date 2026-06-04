'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useStudies } from '@/hooks/useStudies'
import { STUDY_CATALOG, STUDY_STAGES } from '@/data/study-catalog'
import { StudyTypeBadge } from '@/components/studies/StudyTypeBadge'
import { GroupStatusBadge } from '@/components/studies/GroupStatusBadge'
import { sedeLabel } from '@/lib/sedes'
import { Archive, Pencil, Search, X } from 'lucide-react'

const PAGE_SIZE = 10

const inputCls = 'rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

function getLevelColor(level: string): string {
  switch (level) {
    case 'Básico':     return 'rgba(112,189,194,.15)'
    case 'Intermedio': return 'rgba(22,20,64,.07)'
    case 'Avanzado':   return 'rgba(239,85,84,.1)'
    default:           return 'var(--surface-low)'
  }
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
            className="btn btn-primary btn-sm"
          >
            Sí, archivar
          </button>
          <button
            onClick={onCancel}
            className="btn btn-ghost btn-sm"
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

  const { studyTypes, groups } = useStudies()
  const studyType = studyTypes.find(s => s.id === id)
  const catalog   = STUDY_CATALOG.find(s => s.code === id)

  const [showArchive, setShowArchive] = useState(false)
  const [archived,    setArchived]    = useState(false)
  const [search,       setSearch]      = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [zoneFilter,   setZoneFilter]   = useState<string>('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const studyGroups = groups.filter(g => g.study_type_id === id)

  const filteredGroups = studyGroups.filter(g => {
    const matchSearch = !search.trim() ||
      g.leader_name?.toLowerCase().includes(search.toLowerCase()) ||
      g.zone?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || g.status === statusFilter
    const matchZone   = zoneFilter === 'all'   || g.zone === zoneFilter
    return matchSearch && matchStatus && matchZone
  })

  const visibleGroups = filteredGroups.slice(0, visibleCount)
  const hasMore    = visibleCount < filteredGroups.length
  const remaining  = filteredGroups.length - visibleCount
  const uniqueZones = Array.from(new Set(studyGroups.map(g => g.zone).filter(Boolean))) as string[]

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [search, statusFilter, zoneFilter])

  if (!studyType || !catalog) {
    return (
      <div className="page">
        <div className="ph">
          <div className="ptitle">Plan de Estudios</div>
        </div>
        <div className="card" style={{ padding: 22 }}>
          <p className="text-sm text-center py-8" style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-body)' }}>
            Tipo de estudio no encontrado.
          </p>
        </div>
      </div>
    )
  }

  const stageInfo = STUDY_STAGES[catalog.stage as keyof typeof STUDY_STAGES]

  return (
    <div className="page">

      {showArchive && (
        <ConfirmModal
          onConfirm={() => { setArchived(true); setShowArchive(false) }}
          onCancel={() => setShowArchive(false)}
        />
      )}

      {/* ── Header ── */}
      <div className="ph">
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => router.back()}
          style={{ marginBottom: 10 }}
        >
          ← Volver
        </button>
        <div className="ph-row">
          <div>
            <div className="ptitle">{catalog.name}</div>
            <div className="psub">
              {stageInfo?.label}
              {archived && <span style={{ marginLeft: 8, color: 'var(--brand-coral)', fontWeight: 600 }}>[Archivado]</span>}
            </div>
          </div>
          <div className="ph-actions">
            {!archived && (
              <button className="btn btn-ghost btn-sm" onClick={() => setShowArchive(true)}>
                <Archive size={13} /> Archivar
              </button>
            )}
            <button
              className="btn btn-primary btn-sm"
              onClick={() => router.push(`/estudios/plan/${id}/editar`)}
            >
              <Pencil size={13} /> Editar
            </button>
          </div>
        </div>
      </div>

      {/* ── Card info ── */}
      <div className="card">
        <div className="card-hd" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <StudyTypeBadge code={catalog.code} />
            <div>
              <div className="card-title">{catalog.name}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2, fontFamily: 'var(--font-body)' }}>
                {stageInfo?.label} · {catalog.weeks} semanas
                {catalog.level && ` · Nivel ${catalog.level}`}
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Descripción */}
          {catalog.description && (
            <div>
              <div className="st">Descripción</div>
              <p style={{ fontSize: 13, color: 'var(--brand-navy)', lineHeight: 1.6, marginTop: 4, fontFamily: 'var(--font-body)' }}>
                {catalog.description}
              </p>
            </div>
          )}

          {/* Mentor */}
          <div>
            <div className="st">Mentor</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, fontFamily: 'var(--font-body)' }}>
              {catalog.mentor
                ? catalog.mentor
                : <span style={{ color: 'var(--fg-muted)', fontWeight: 400 }}>Sin mentor asignado</span>}
            </div>
          </div>

          {/* Compromisos (texto) */}
          {catalog.commitments && (
            <div>
              <div className="st">Compromisos</div>
              <div style={{
                fontSize: 12, color: 'var(--fg-muted)',
                background: 'var(--surface-low)', padding: '6px 10px',
                borderRadius: 8, marginTop: 4, display: 'inline-block',
                fontFamily: 'var(--font-body)',
              }}>
                📋 {catalog.commitments}
              </div>
            </div>
          )}

          {/* Fila de datos rápidos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            <div>
              <div className="st">Duración</div>
              <div style={{ fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-body)' }}>{catalog.weeks} semanas</div>
            </div>
            {catalog.level && (
              <div>
                <div className="st">Nivel</div>
                <span style={{
                  fontSize: 12, padding: '2px 8px', borderRadius: 999,
                  background: getLevelColor(catalog.level), fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                }}>
                  {catalog.level}
                </span>
              </div>
            )}
            <div>
              <div className="st">Costo</div>
              <div style={{ fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-body)' }}>
                {catalog.requires_payment
                  ? `₡${(catalog.cost ?? 0).toLocaleString('es-CR')}`
                  : 'Gratuito'}
              </div>
            </div>
            <div>
              <div className="st">Prerequisito</div>
              <div style={{ fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-body)' }}>
                {catalog.prerequisite
                  ? STUDY_CATALOG.find(s => s.code === catalog.prerequisite)?.name || catalog.prerequisite
                  : 'Ninguno'}
              </div>
            </div>
          </div>

          {/* Requisitos de compromiso */}
          {(catalog.req_donor || catalog.req_server || catalog.req_attendee) && (
            <div>
              <div className="st">Compromisos requeridos para matricular</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                {catalog.req_donor    && <span className="badge b-donor">Ser donador activo</span>}
                {catalog.req_server   && <span className="badge b-server">Servir en un comité</span>}
                {catalog.req_attendee && <span className="badge b-study">Asistencia regular a charlas</span>}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Grupos ── */}
      <div className="card">
        <div className="card-hd" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="card-title">
            Grupos activos
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--fg-muted)', marginLeft: 8, fontFamily: 'var(--font-body)' }}>
              ({filteredGroups.length}{filteredGroups.length !== studyGroups.length ? ` de ${studyGroups.length}` : ''})
            </span>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => router.push('/estudios/grupos/nuevo')}
          >
            + Nuevo grupo
          </button>
        </div>

        {/* Filters */}
        <div style={{ padding: '12px 22px', display: 'flex', flexWrap: 'wrap', gap: 8, borderBottom: '1px solid rgba(22,20,64,0.09)' }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(41,54,92,0.4)', pointerEvents: 'none' }} />
            <input
              className={inputCls}
              style={{ fontFamily: 'var(--font-body)', paddingLeft: 30, minWidth: 200 }}
              placeholder="Buscar por dirigente o zona..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'rgba(41,54,92,0.4)' }}
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

        {/* Table or empty */}
        {filteredGroups.length === 0 ? (
          <div style={{ padding: '40px 22px', textAlign: 'center' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(41,54,92,0.4)', fontFamily: 'var(--font-display)' }}>Sin resultados</p>
            <p style={{ fontSize: 12, color: 'rgba(41,54,92,0.35)', marginTop: 4, fontFamily: 'var(--font-body)' }}>Probá con otros filtros</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(22,20,64,0.09)' }}>
                    {['Dirigente', 'Zona', 'Horario', 'Participantes', 'Estado', 'Semana', ''].map(h => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left"
                        style={{ fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(41,54,92,0.4)', fontFamily: 'var(--font-display)' }}
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
                      style={{ borderBottom: '1px solid rgba(22,20,64,0.06)' }}
                      onClick={() => router.push(`/estudios/grupos/${group.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%', background: 'var(--brand-navy)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0,
                          }}>
                            {group.leader_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? '?'}
                          </div>
                          <span style={{ fontSize: 13, color: 'var(--brand-navy)', fontFamily: 'var(--font-body)' }}>
                            {group.leader_name ?? <span style={{ color: '#d97706', fontSize: 11 }}>Sin asignar</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3" style={{ fontSize: 13, color: 'rgba(41,54,92,0.7)', fontFamily: 'var(--font-body)' }}>
                        {sedeLabel(group.zone)}
                      </td>
                      <td className="px-4 py-3" style={{ fontSize: 12, color: 'rgba(41,54,92,0.6)', fontFamily: 'var(--font-body)' }}>
                        {group.schedule_days.join('/')} {group.schedule_time}
                      </td>
                      <td className="px-4 py-3">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 60, height: 5, borderRadius: 999, background: 'rgba(22,20,64,0.12)', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 999, background: 'var(--brand-coral)',
                              width: `${(group.participants.filter((p: { status: string }) => p.status !== 'withdrawn').length / group.max_capacity) * 100}%`,
                            }} />
                          </div>
                          <span style={{ fontSize: 12, color: 'rgba(41,54,92,0.7)', fontFamily: 'var(--font-body)' }}>
                            {group.participants.filter((p: { status: string }) => p.status !== 'withdrawn').length}/{group.max_capacity}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <GroupStatusBadge status={group.status} />
                      </td>
                      <td className="px-4 py-3" style={{ fontSize: 12, color: 'rgba(41,54,92,0.6)', fontFamily: 'var(--font-body)' }}>
                        {group.status === 'in_progress' ? `Sem. ${group.current_week}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          className="btn btn-ghost btn-sm"
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 22px', borderTop: '1px solid rgba(22,20,64,0.09)' }}>
                <span style={{ fontSize: 12, color: 'rgba(41,54,92,0.5)', fontFamily: 'var(--font-body)' }}>
                  Mostrando {visibleCount} de {filteredGroups.length} grupos
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
                  >
                    Cargar {Math.min(PAGE_SIZE, remaining)} más
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setVisibleCount(filteredGroups.length)}
                  >
                    Ver todos ({filteredGroups.length})
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  )
}
