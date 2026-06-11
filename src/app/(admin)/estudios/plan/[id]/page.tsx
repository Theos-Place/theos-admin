'use client'

import { use, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useStudies } from '@/hooks/useStudies'
import { useDirigentes } from '@/hooks/useDirigentes'
import { STUDY_CATALOG, STUDY_STAGES } from '@/data/study-catalog'
import { StudyTypeBadge } from '@/components/studies/StudyTypeBadge'
import { GroupStatusBadge } from '@/components/studies/GroupStatusBadge'
import { sedeLabel } from '@/lib/sedes'
import { cn } from '@/lib/utils'
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
        className="relative rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4 bg-surface-card shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-center gap-3">
          <Archive size={20} className="text-coral" />
          <h3 className="font-semibold text-navy font-display">
            Archivar estudio
          </h3>
        </div>
        <p className="text-sm text-navy-light/70 font-body">
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

  const { studyTypes, groups, refetch } = useStudies()
  const studyType = studyTypes.find(s => s.id === id)
  const catalog   = STUDY_CATALOG.find(s => s.code === id)

  const [showArchive, setShowArchive] = useState(false)
  const [busy,        setBusy]        = useState(false)
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

  if (!studyType) {
    return (
      <div className="page">
        <div className="ph">
          <div className="ptitle">Plan de Estudios</div>
        </div>
        <div className="card p-[22px]">
          <p className="text-sm text-center py-8 text-[var(--fg-muted)] font-body">
            Tipo de estudio no encontrado.
          </p>
        </div>
      </div>
    )
  }

  // Vista del plan: datos reales (studyType) + extras opcionales del catálogo (descripción, mentor…).
  const view = {
    code: studyType.code,
    name: studyType.name,
    stage: studyType.stage,
    weeks: studyType.weeks,
    requires_payment: studyType.requires_payment,
    cost: studyType.cost,
    prerequisite: studyType.prerequisite,
    req_donor: studyType.req_donor,
    req_server: studyType.req_server,
    req_attendee: studyType.req_attendee,
    requires_invitation: studyType.requires_invitation ?? false,
    level: catalog?.level,
    description: catalog?.description,
    mentor: catalog?.mentor,
    commitments: catalog?.commitments,
  }

  const stageInfo = STUDY_STAGES[view.stage as keyof typeof STUDY_STAGES]
  const isArchived = studyType.is_archived

  // Archivar/desarchivar persiste (is_active) y refresca.
  async function setArchive(val: boolean) {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/studies/plans/${studyType!.plan_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !val }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await refetch()
    } catch (err) {
      console.error('No se pudo cambiar el archivado:', err)
    } finally {
      setBusy(false)
      setShowArchive(false)
    }
  }

  return (
    <div className="page">

      {showArchive && (
        <ConfirmModal
          onConfirm={() => setArchive(true)}
          onCancel={() => setShowArchive(false)}
        />
      )}

      {/* ── Header ── */}
      <div className="ph">
        <button
          className="btn btn-ghost btn-sm mb-[10px]"
          onClick={() => router.back()}
        >
          ← Volver
        </button>
        <div className="ph-row">
          <div>
            <div className="ptitle">{view.name}</div>
            <div className="psub">
              {stageInfo?.label}
              {isArchived && <span className="ml-2 text-coral font-semibold">[Archivado]</span>}
            </div>
          </div>
          <div className="ph-actions">
            {isArchived ? (
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setArchive(false)}>
                <Archive size={13} /> Desarchivar
              </button>
            ) : (
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setShowArchive(true)}>
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
        <div className="card-hd flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StudyTypeBadge code={view.code} />
            <div>
              <div className="card-title">{view.name}</div>
              <div className="text-[12px] text-[var(--fg-muted)] mt-0.5 font-body">
                {stageInfo?.label} · {view.weeks} semanas
                {view.level && ` · Nivel ${view.level}`}
              </div>
            </div>
          </div>
        </div>

        <div className="py-5 px-[22px] flex flex-col gap-[18px]">

          {/* Descripción */}
          {view.description && (
            <div>
              <div className="st">Descripción</div>
              <p className="text-[13px] text-navy-light leading-[1.6] mt-1 font-body">
                {view.description}
              </p>
            </div>
          )}

          {/* Dirigente referente */}
          <div>
            <div className="st">Dirigente referente</div>
            <div className="mt-1">
              <DirigenteReferenteSelect
                value={studyType.mentor_id ?? null}
                onChange={async (memberId) => {
                  if (!studyType.plan_id) return
                  await fetch(`/api/studies/plans/${studyType.plan_id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mentor_id: memberId }),
                  })
                  refetch()
                }}
              />
            </div>
          </div>

          {/* Compromisos (texto) */}
          {view.commitments && (
            <div>
              <div className="st">Compromisos</div>
              <div className="text-[12px] text-[var(--fg-muted)] bg-surface-low py-1.5 px-2.5 rounded-lg mt-1 inline-block font-body">
                📋 {view.commitments}
              </div>
            </div>
          )}

          {/* Fila de datos rápidos */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
            <div>
              <div className="st">Duración</div>
              <div className="font-semibold text-[13px] font-body">{view.weeks} semanas</div>
            </div>
            {view.level && (
              <div>
                <div className="st">Nivel</div>
                <span
                  className="text-[12px] py-0.5 px-2 rounded-full font-semibold font-body"
                  style={{ background: getLevelColor(view.level) }}
                >
                  {view.level}
                </span>
              </div>
            )}
            <div>
              <div className="st">Costo</div>
              <div className="font-semibold text-[13px] font-body">
                {view.requires_payment
                  ? `₡${(view.cost ?? 0).toLocaleString('es-CR')}`
                  : 'Gratuito'}
              </div>
            </div>
            <div>
              <div className="st">Prerequisito</div>
              <div className="font-semibold text-[13px] font-body">
                {view.prerequisite
                  ? studyTypes.find(s => s.code === view.prerequisite)?.name
                    || STUDY_CATALOG.find(s => s.code === view.prerequisite)?.name
                    || view.prerequisite
                  : 'Ninguno'}
              </div>
            </div>
          </div>

          {view.requires_invitation && (
            <div>
              <div className="st">Acceso</div>
              <div className="flex gap-2 flex-wrap mt-1.5">
                <span className="badge bg-[rgba(155,127,212,0.15)] text-[#7C5EC2]">Solo por invitación</span>
              </div>
            </div>
          )}

          {/* Requisitos de compromiso */}
          {(view.req_donor || view.req_server || view.req_attendee) && (
            <div>
              <div className="st">Compromisos requeridos para matricular</div>
              <div className="flex gap-2 flex-wrap mt-1.5">
                {view.req_donor    && <span className="badge b-donor">Ser donador activo</span>}
                {view.req_server   && <span className="badge b-server">Servir en un comité</span>}
                {view.req_attendee && <span className="badge b-study">Asistencia regular a charlas</span>}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Grupos ── */}
      <div className="card">
        <div className="card-hd flex items-center justify-between">
          <div className="card-title">
            Listado de grupos
            <span className="text-[12px] font-normal text-[var(--fg-muted)] ml-2 font-body">
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
        <div className="py-3 px-[22px] flex flex-wrap gap-2 border-b border-[rgba(22,20,64,0.09)]">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[rgba(41,54,92,0.4)] pointer-events-none" />
            <input
              className={`${inputCls} font-body pl-[30px] min-w-[200px]`}
              placeholder="Buscar por dirigente o zona..."
              aria-label="Buscar por dirigente o zona"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[rgba(41,54,92,0.4)]"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <select
            className={`${inputCls} font-body`}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">Todos los estados</option>
            <option value="open">Abierto</option>
            <option value="in_progress">En curso</option>
            <option value="en_matricula">En matrícula</option>
            <option value="finished">Finalizado</option>
          </select>

          <select
            className={`${inputCls} font-body`}
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
          <div className="py-10 px-[22px] text-center">
            <p className="text-[14px] font-semibold text-[rgba(41,54,92,0.4)] font-display">Sin resultados</p>
            <p className="text-[12px] text-[rgba(41,54,92,0.35)] mt-1 font-body">Probá con otros filtros</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[rgba(22,20,64,0.09)]">
                    {['Dirigente', 'Zona', 'Horario', 'Participantes', 'Estado', 'Año', ''].map(h => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[10px] tracking-[0.07em] uppercase text-[rgba(41,54,92,0.4)] font-display"
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
                      className="hover:bg-surface-low transition-colors cursor-pointer border-b border-[rgba(22,20,64,0.06)]"
                      onClick={() => router.push(`/estudios/grupos/${group.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-navy-light flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                            {group.leader_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? '?'}
                          </div>
                          <span className="text-[13px] text-navy-light font-body">
                            {group.leader_name ?? <span className="text-[#d97706] text-[11px]">Sin asignar</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[rgba(41,54,92,0.7)] font-body">
                        {sedeLabel(group.zone)}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[rgba(41,54,92,0.6)] font-body">
                        {group.schedule_days.join('/')} {group.schedule_time}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-[60px] h-[5px] rounded-full bg-[rgba(22,20,64,0.12)] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-coral"
                              style={{
                                width: `${group.max_capacity > 0 ? (group.participants.filter((p: { status: string }) => p.status !== 'withdrawn').length / group.max_capacity) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <span className="text-[12px] text-[rgba(41,54,92,0.7)] font-body">
                            {group.participants.filter((p: { status: string }) => p.status !== 'withdrawn').length}/{group.max_capacity}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <GroupStatusBadge status={group.status} />
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[rgba(41,54,92,0.6)] font-body">
                        {group.start_date ? new Date(group.start_date).getFullYear() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/estudios/grupos/${group.id}`}
                          className="btn btn-ghost btn-sm"
                          onClick={e => e.stopPropagation()}
                        >
                          Ver →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <div className="flex items-center justify-between py-3 px-[22px] border-t border-[rgba(22,20,64,0.09)]">
                <span className="text-[12px] text-[rgba(41,54,92,0.5)] font-body">
                  Mostrando {visibleCount} de {filteredGroups.length} grupos
                </span>
                <div className="flex gap-2">
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

// ─── Selector de Dirigente referente (dropdown con búsqueda) ─────────────────────
function dInitials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase()
}

function DirigenteReferenteSelect({ value, onChange }: {
  value: string | null
  onChange: (memberId: string | null) => void
}) {
  const { dirigentes } = useDirigentes()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const selected = dirigentes.find(d => d.member_id === value)
  const filtered = dirigentes
    .filter(d => d.member_name.toLowerCase().includes(q.trim().toLowerCase()))
    .slice(0, 50)

  const Badge = ({ status }: { status: 'activo' | 'inactivo' }) => (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium font-body',
      status === 'activo' ? 'bg-[rgba(61,185,122,0.12)] text-[#3DB97A]' : 'bg-surface-low text-navy-light/50')}>
      {status === 'activo' ? 'Activo' : 'Inactivo'}
    </span>
  )

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 rounded-2xl border border-[var(--outline-variant)] bg-surface-low px-3 py-2 text-left hover:bg-surface-container transition-colors"
      >
        {selected ? (
          <>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy text-[10px] font-display font-extrabold">
              {dInitials(selected.member_name) || '—'}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-navy font-body">{selected.member_name}</span>
            <Badge status={selected.status} />
          </>
        ) : (
          <span className="flex-1 text-sm text-navy-light/50 font-body">Sin dirigente referente</span>
        )}
        <span className="text-navy-light/40 text-xs">▾</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-2xl bg-surface-card shadow-[var(--shadow-lg)] border border-[var(--outline-variant)] overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--outline-variant)]">
            <Search size={14} className="text-navy-light/40 shrink-0" />
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar dirigente…"
              aria-label="Buscar dirigente"
              className="w-full bg-transparent text-sm text-navy outline-none font-body"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false) }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-navy-light/60 hover:bg-surface-low transition-colors font-body"
            >
              <X size={14} /> Quitar dirigente referente
            </button>
            {filtered.map(d => (
              <button
                key={d.member_id}
                type="button"
                onClick={() => { onChange(d.member_id); setOpen(false) }}
                className={cn('flex w-full items-center gap-2 px-3 py-2 hover:bg-surface-low transition-colors',
                  d.member_id === value && 'bg-coral/5')}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy text-[10px] font-display font-extrabold">
                  {dInitials(d.member_name) || '—'}
                </span>
                <span className="min-w-0 flex-1 truncate text-left text-sm text-navy font-body">{d.member_name}</span>
                <Badge status={d.status} />
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-xs text-navy-light/40 font-body">Sin resultados.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
