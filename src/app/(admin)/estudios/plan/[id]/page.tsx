'use client'

import { use, useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useStudies } from '@/hooks/useStudies'
import { MemberCombobox } from '@/components/shared/MemberCombobox'
import { PlanInvitations } from '@/components/studies/PlanInvitations'
import { useAuth } from '@/hooks/useAuth'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { AccessDenied } from '@/components/shared/AccessDenied'
import { STUDY_STAGES } from '@/data/study-catalog'
import { StudyTypeBadge } from '@/components/studies/StudyTypeBadge'
import { GroupStatusBadge } from '@/components/studies/GroupStatusBadge'
import { sedeLabel } from '@/lib/sedes'
import { cn } from '@/lib/utils'
import { Archive, Pencil, Search, X, Bus, ChevronLeft, Plus } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { useToast } from '@/components/shared/Toast'
import { formatMoney } from '@/lib/format'

const PAGE_SIZE = 10

const inputCls = 'rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'
const sectionLabelCls = 'text-[11px] tracking-widest uppercase text-navy-light/80 font-display'

function levelPillCls(level: string): string {
  switch (level) {
    case 'Básico':     return 'bg-teal-soft/30 text-teal-deep'
    case 'Intermedio': return 'bg-navy/10 text-navy'
    case 'Avanzado':   return 'bg-coral/10 text-coral'
    default:           return 'bg-surface-low text-navy-light/80'
  }
}

function ConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal onClose={onCancel} titleId="archivar-estudio-title" width={384}>
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Archive size={20} className="text-coral" />
          <h3 id="archivar-estudio-title" className="font-semibold text-navy font-display">
            Desactivar estudio
          </h3>
        </div>
        <p className="text-sm text-navy-light/80 font-body">
          Al desactivar este tipo de estudio no podrás crear nuevos grupos con él. Los grupos existentes no se ven afectados.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            className="flex-1 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors font-body"
          >
            Sí, desactivar
          </button>
          <button
            onClick={onCancel}
            className="rounded-full border border-[var(--outline-variant)] px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
          >
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function PlanDeEstudioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const toast = useToast()
  const { hasRole, loaded } = useAuth()

  const { studyTypes, groups, refetch } = useStudies('plans', 'groups')
  const studyType = studyTypes.find(s => s.id === id)

  const [showArchive, setShowArchive] = useState(false)
  const [busy,        setBusy]        = useState(false)
  const [search,       setSearch]      = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [zoneFilter,   setZoneFilter]   = useState<string>('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // Memo: son ~2,000 grupos y esto corría en CADA render (cada keystroke del buscador).
  const studyGroups = useMemo(() => groups.filter(g => g.study_type_id === id), [groups, id])

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase()
    return studyGroups.filter(g => {
      const matchSearch = !q ||
        g.leader_name?.toLowerCase().includes(q) ||
        g.zone?.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || g.status === statusFilter
      const matchZone   = zoneFilter === 'all'   || g.zone === zoneFilter
      return matchSearch && matchStatus && matchZone
    })
  }, [studyGroups, search, statusFilter, zoneFilter])

  const visibleGroups = useMemo(() => filteredGroups.slice(0, visibleCount), [filteredGroups, visibleCount])
  const hasMore    = visibleCount < filteredGroups.length
  const remaining  = filteredGroups.length - visibleCount
  const uniqueZones = useMemo(
    () => Array.from(new Set(studyGroups.map(g => g.zone).filter(Boolean))) as string[],
    [studyGroups],
  )

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [search, statusFilter, zoneFilter])

  // El detalle (listado de grupos del tipo) es solo para roles de estudios.
  // Protección por URL: un miembro que tipea la ruta ve acceso denegado.
  if (loaded && !hasRole(...STUDY_ADMIN_ROLES)) {
    return <AccessDenied />
  }

  if (!studyType) {
    return (
      <div className="space-y-4">
        <Link
          href="/estudios/plan"
          className="flex items-center gap-1 text-sm text-navy-light/80 hover:text-navy transition-colors font-body"
        >
          <ChevronLeft size={16} /> Plan de Estudios
        </Link>
        <p className="text-navy-light/80 font-body">Tipo de estudio no encontrado.</p>
      </div>
    )
  }

  // Vista del plan: todo desde la BD (study_plans). Descripción/dificultad/
  // compromisos/mentor migrados del catálogo a la BD (migrate-study-catalog).
  const view = {
    code: studyType.code,
    name: studyType.name,
    stage: studyType.stage,
    weeks: studyType.weeks,
    requires_payment: studyType.requires_payment,
    cost: studyType.cost,
    currency: studyType.currency,
    prerequisite: studyType.prerequisite,
    req_donor: studyType.req_donor,
    req_server: studyType.req_server,
    req_attendee: studyType.req_attendee,
    req_bus: studyType.req_bus ?? false,
    requires_invitation: studyType.requires_invitation ?? false,
    level: studyType.difficulty,
    description: studyType.description,
    mentor: studyType.mentor_name,
    commitments: studyType.commitments,
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
      toast(`No se pudo ${val ? 'desactivar' : 'activar'} el plan de estudio. Intentá de nuevo.`, 'error')
    } finally {
      setBusy(false)
      setShowArchive(false)
    }
  }

  return (
    <div className="space-y-5">

      {showArchive && (
        <ConfirmModal
          onConfirm={() => setArchive(true)}
          onCancel={() => setShowArchive(false)}
        />
      )}

      {/* ── Back ── */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-navy-light/80 hover:text-navy transition-colors font-body"
      >
        <ChevronLeft size={16} /> Volver
      </button>

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <StudyTypeBadge code={view.code} />
          <div>
            <h1 className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">
              {view.name}
            </h1>
            <p className="mt-0.5 text-sm text-navy-light/80 font-body">
              {stageInfo?.label} · {view.weeks} semanas
              {view.level && ` · Nivel ${view.level}`}
              {isArchived && <span className="ml-2 text-coral font-semibold">[Desactivado]</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {isArchived ? (
            <button
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors disabled:opacity-40 font-body"
              disabled={busy}
              onClick={() => setArchive(false)}
            >
              <Archive size={13} /> Activar
            </button>
          ) : (
            <button
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors disabled:opacity-40 font-body"
              disabled={busy}
              onClick={() => setShowArchive(true)}
            >
              <Archive size={13} /> Desactivar
            </button>
          )}
          <button
            className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors font-body"
            onClick={() => router.push(`/estudios/plan/${id}/editar`)}
          >
            <Pencil size={13} /> Editar
          </button>
        </div>
      </div>

      {/* ── Card info ── */}
      <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* Columna principal: descripción, dirigente, compromisos */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            {view.description && (
              <div>
                <p className={sectionLabelCls}>Descripción</p>
                <p className="text-[13px] text-navy-light leading-[1.6] mt-1 font-body">
                  {view.description}
                </p>
              </div>
            )}

            <div>
              <p className={sectionLabelCls}>Dirigente encargado</p>
              <div className="mt-1.5 max-w-md">
                <DirigenteReferenteSelect
                  value={studyType.mentor_id ?? null}
                  currentName={studyType.mentor_name ?? null}
                  onChange={async (memberId) => {
                    if (!studyType.plan_id) return
                    try {
                      const res = await fetch(`/api/studies/plans/${studyType.plan_id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ mentor_id: memberId }),
                      })
                      if (!res.ok) throw new Error(`HTTP ${res.status}`)
                    } catch (err) {
                      console.error('No se pudo cambiar el dirigente encargado:', err)
                      toast('No se pudo cambiar el dirigente encargado del plan. Intentá de nuevo.', 'error')
                    }
                    refetch()
                  }}
                />
              </div>
            </div>

            {view.commitments && (
              <div>
                <p className={sectionLabelCls}>Compromisos</p>
                <div className="mt-1.5 inline-block rounded-xl bg-surface-low px-3 py-1.5 text-[13px] text-navy-light/80 font-body">
                  📋 {view.commitments}
                </div>
              </div>
            )}

            {view.requires_invitation && (
              <div>
                <p className={sectionLabelCls}>Acceso</p>
                <div className="mt-1.5">
                  <span className="inline-flex items-center rounded-full bg-[rgba(155,127,212,0.15)] px-2.5 py-1 text-[13px] font-medium text-[#7C5EC2] font-body">
                    Solo por invitación
                  </span>
                </div>
              </div>
            )}

            {/* Requisitos de compromiso */}
            {(view.req_donor || view.req_server || view.req_attendee || view.req_bus) && (
              <div>
                <p className={sectionLabelCls}>Compromisos requeridos para matricular</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {view.req_donor && (
                    <span className="inline-flex items-center rounded-full bg-coral/10 px-2.5 py-1 text-[13px] font-medium text-coral font-body">
                      Ser donador activo
                    </span>
                  )}
                  {view.req_server && (
                    <span className="inline-flex items-center rounded-full bg-teal-soft/30 px-2.5 py-1 text-[13px] font-medium text-teal-deep font-body">
                      Servir en un comité
                    </span>
                  )}
                  {view.req_attendee && (
                    <span className="inline-flex items-center rounded-full bg-navy/10 px-2.5 py-1 text-[13px] font-medium text-navy font-body">
                      Asistencia regular a charlas
                    </span>
                  )}
                  {view.req_bus && (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full bg-coral/10 px-2.5 py-1 text-[13px] font-medium text-coral font-body"
                      title="Haber asistido a la charla del Bus"
                    >
                      <Bus size={14} aria-hidden />
                      Charla del Bus
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Columna lateral: datos rápidos */}
          <div className="grid grid-cols-2 gap-4 content-start lg:grid-cols-1">
            <div>
              <p className={sectionLabelCls}>Duración</p>
              <p className="mt-1 text-sm font-semibold text-navy font-body">{view.weeks} semanas</p>
            </div>
            {view.level && (
              <div>
                <p className={sectionLabelCls}>Nivel</p>
                <span className={cn('mt-1 inline-block rounded-full px-2.5 py-0.5 text-[13px] font-semibold font-body', levelPillCls(view.level))}>
                  {view.level}
                </span>
              </div>
            )}
            <div>
              <p className={sectionLabelCls}>Costo</p>
              <p className="mt-1 text-sm font-semibold text-navy font-body">
                {view.requires_payment
                  ? formatMoney(view.cost ?? 0, view.currency)
                  : 'Gratuito'}
              </p>
            </div>
            <div>
              <p className={sectionLabelCls}>Prerrequisito</p>
              <p className="mt-1 text-sm font-semibold text-navy font-body">
                {view.prerequisite
                  ? studyTypes.find(s => s.code === view.prerequisite)?.name || view.prerequisite
                  : 'Ninguno'}
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* ── Invitados (solo planes por invitación) ── */}
      {view.requires_invitation && studyType.plan_id && <PlanInvitations planId={studyType.plan_id} />}

      {/* ── Grupos ── */}
      <div className="overflow-hidden rounded-2xl bg-surface-card shadow-[var(--shadow-md)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--outline-variant)] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-navy font-display">
              Listado de grupos
            </h2>
            <p className="mt-0.5 text-xs text-navy-light/80 font-body">
              {filteredGroups.length}{filteredGroups.length !== studyGroups.length ? ` de ${studyGroups.length}` : ''} grupos
            </p>
          </div>
          <button
            className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors font-body"
            onClick={() => router.push('/estudios/grupos/nuevo')}
          >
            <Plus size={14} strokeWidth={1.75} /> Nuevo grupo
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 border-b border-[var(--outline-variant)] px-5 py-3">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-navy-light/80 pointer-events-none" />
            <input
              className={`${inputCls} pl-[30px] min-w-[200px]`}
              placeholder="Buscar por dirigente o zona..."
              aria-label="Buscar por dirigente o zona"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-navy-light/80 hover:text-navy transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <select
            className={inputCls}
            aria-label="Filtrar por estado"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            {/* Los values coinciden con GroupStatus real (antes había opciones
                en inglés que nunca matcheaban y devolvían "Sin resultados"). */}
            <option value="all">Todos los estados</option>
            <option value="en_matricula">En matrícula</option>
            <option value="en_curso">En curso</option>
            <option value="finalizado">Finalizado</option>
          </select>

          <select
            className={inputCls}
            aria-label="Filtrar por zona"
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
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-semibold text-navy-light/80 font-display">Sin resultados</p>
            <p className="mt-1 text-xs text-navy-light/80 font-body">Probá con otros filtros</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[var(--outline-variant)]">
                    {['Dirigente', 'Zona', 'Horario', 'Participantes', 'Estado', 'Año', ''].map((h, i) => (
                      <th
                        key={`${h}-${i}`}
                        className="px-4 py-3 text-left text-[11px] tracking-widest uppercase text-navy-light/80 font-display"
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
                      className="hover:bg-surface-low transition-colors cursor-pointer border-b border-[var(--outline-variant)]"
                      onClick={() => router.push(`/estudios/grupos/${group.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-navy/10 flex items-center justify-center text-[11px] font-bold text-navy shrink-0">
                            {group.leader_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? '?'}
                          </div>
                          <span className="text-sm text-navy font-body">
                            {group.leader_name ?? <span className="text-amber-600 text-[13px]">Sin asignar</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-navy-light/80 font-body">
                        {sedeLabel(group.zone)}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body">
                        {group.schedule_days.join('/')} {group.schedule_time}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-[60px] rounded-full bg-surface-low overflow-hidden">
                            <div
                              className="h-full rounded-full bg-coral"
                              style={{
                                width: `${group.max_capacity > 0 ? (group.participants.filter((p: { status: string }) => p.status !== 'withdrawn').length / group.max_capacity) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <span className="text-[13px] text-navy-light/80 font-body">
                            {group.participants.filter((p: { status: string }) => p.status !== 'withdrawn').length}/{group.max_capacity}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <GroupStatusBadge status={group.status} />
                      </td>
                      <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body">
                        {group.start_date ? new Date(group.start_date).getFullYear() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/estudios/grupos/${group.id}`}
                          className="rounded-lg border border-[var(--outline-variant)] px-2.5 py-1 text-[13px] text-navy-light hover:bg-surface-low transition-colors font-body"
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
              <div className="flex items-center justify-between border-t border-[var(--outline-variant)] px-5 py-3">
                <span className="text-[13px] text-navy-light/80 font-body">
                  Mostrando {visibleCount} de {filteredGroups.length} grupos
                </span>
                <div className="flex gap-2">
                  <button
                    className="rounded-full border border-[var(--outline-variant)] px-3 py-1.5 text-[13px] text-navy-light hover:bg-surface-low transition-colors font-body"
                    onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
                  >
                    Cargar {Math.min(PAGE_SIZE, remaining)} más
                  </button>
                  <button
                    className="rounded-full border border-[var(--outline-variant)] px-3 py-1.5 text-[13px] text-navy-light hover:bg-surface-low transition-colors font-body"
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

function DirigenteReferenteSelect({ value, currentName, onChange }: {
  value: string | null
  currentName: string | null
  onChange: (memberId: string | null) => void
}) {
  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-[var(--outline-variant)] bg-surface-low px-3 py-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy text-[11px] font-display font-extrabold">
          {dInitials(currentName ?? '') || '—'}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-navy font-body">
          {currentName ?? 'Dirigente asignado'}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="inline-flex items-center gap-1 text-[13px] text-coral hover:text-coral-deep transition-colors font-body"
        >
          <X size={13} /> Quitar
        </button>
      </div>
    )
  }
  return (
    <MemberCombobox
      dropdown
      placeholder="Buscar miembro por nombre o cédula…"
      onSelect={(m) => onChange(m.id)}
    />
  )
}
