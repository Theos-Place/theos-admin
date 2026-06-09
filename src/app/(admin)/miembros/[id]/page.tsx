'use client'

import { useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { notFound } from 'next/navigation'
import { useMember } from '@/hooks/useMember'
import { STUDY_CATALOG } from '@/data/study-catalog'
import { cn } from '@/lib/utils'
import { MemberHeader } from './_components/MemberHeader'
import { MemberSummaryTab } from './_components/MemberSummaryTab'
import { MemberPersonalTab } from './_components/MemberPersonalTab'
import { MemberParticipationTab } from './_components/MemberParticipationTab'
import { MemberFamilyTab } from './_components/MemberFamilyTab'
import { MemberWalletTab } from './_components/MemberWalletTab'
import type { StudyRow, ServiceRow, EventoRow, DonacionRow } from './_components/MemberParticipationTab'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'personal', label: 'Info Personal' },
  { id: 'participacion', label: 'Participación' },
  { id: 'familia', label: 'Familia' },
  { id: 'pase', label: 'Pase Digital' },
]

const LOAD_MORE = 10

function useSortableTable<T extends object>(data: T[]) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  function toggleSort(key: keyof T) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }
  const sorted = useMemo(() => {
    if (!sortKey) return data
    return [...data].sort((a, b) => {
      const av = a[sortKey] as string | number
      const bv = b[sortKey] as string | number
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir])
  return { sorted, sortKey, sortDir, toggleSort }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MiembroDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : ''

  const { member, loading, notFound: isNotFound, error } = useMember(id || undefined)

  const [activeTab, setActiveTab] = useState('resumen')
  const [menuOpen, setMenuOpen] = useState(false)
  const [revealDonations, setRevealDonations] = useState(false)
  const [openSections, setOpenSections] = useState({
    estudios: true,
    servicio: false,
    eventos: false,
    donaciones: false,
  })

  function changeTab(tab: string) {
    setActiveTab(tab)
  }

  function toggleSection(key: keyof typeof openSections) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Derived (safe-against-null para no romper los hooks de abajo mientras carga)
  const currentStudyEntry = member?.current_study
    ? STUDY_CATALOG.find(s => s.code === member.current_study)
    : null

  const currentWeek = member?.current_study_week ?? 0

  const activeService = member?.service_history.find(s => s.status === 'activo')

  const lastStudyCode = member?.completed_studies[member.completed_studies.length - 1]
  const lastStudyEntry = lastStudyCode ? STUDY_CATALOG.find(s => s.code === lastStudyCode) : null

  const hasFinanceRole = true // demo

  // ── Typed rows for sortable tables ──────────────────────────────────────────

  const estudiosRows: StudyRow[] = useMemo(() => {
    if (!member?.study_history) return []
    const STATUS: Record<string, string> = { completed: 'Aprobado', dropped: 'Reprobó', enrolled: 'En curso', waitlist: 'En espera', transferred: 'Transferido' }
    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic']
    const fmt = (date: string | null, year: number | null) => {
      if (date) { const [y, m] = date.split('-'); return `${MESES[Number(m) - 1] ?? ''} ${y}`.trim() }
      return year ? String(year) : '—'
    }
    return member.study_history.map(s => ({
      code: s.code,
      name: s.name || STUDY_CATALOG.find(x => x.code === s.code)?.name || s.code,
      startYear: s.year ?? 0,
      startLabel: fmt(s.date, s.year),
      duration: s.weeks ? `${s.weeks} sem.` : '—',
      status: STATUS[s.status] ?? s.status,
    }))
  }, [member])

  const servicioRows: ServiceRow[] = useMemo(() =>
    (member?.service_history ?? []).map(s => ({
      position: s.position,
      committee: s.committee,
      from: s.from,
      to: s.to ?? '',
      status: s.status,
    })),
  [member])

  const eventosRows: EventoRow[] = useMemo(() =>
    (member?.attendance_history ?? []).map(ev => ({
      name: ev.name,
      type: ev.type,
      date: ev.date,
      attendance_type: ev.attendance_type,
    })),
  [member])

  const donacionesRows: DonacionRow[] = useMemo(() =>
    (member?.donations ?? []).map(d => ({
      date: d.date,
      description: d.description,
      amount: d.amount,
    })),
  [member])

  // ── Sortable tables ──────────────────────────────────────────────────────────
  const estudiosTable  = useSortableTable(estudiosRows)
  const servicioTable  = useSortableTable(servicioRows)
  const eventosTable   = useSortableTable(eventosRows)
  const donacionesTable = useSortableTable(donacionesRows)

  // ── Pagination ───────────────────────────────────────────────────────────────
  const [visibleEstudios,  setVisibleEstudios]  = useState(LOAD_MORE)
  const [visibleServicio,  setVisibleServicio]  = useState(LOAD_MORE)
  const [visibleEventos,   setVisibleEventos]   = useState(LOAD_MORE)
  const [visibleDonaciones, setVisibleDonaciones] = useState(LOAD_MORE)

  // ── Estados de carga (van DESPUÉS de todos los hooks por reglas de React) ──
  if (isNotFound) notFound()
  if (error) {
    return (
      <div className="p-8 text-center text-coral" style={{ fontFamily: 'var(--font-body)' }}>
        Error cargando miembro: {error}
      </div>
    )
  }
  if (loading || !member) {
    return (
      <div className="p-8 text-center text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
        Cargando…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Header Card ── */}
      <MemberHeader
        member={member}
        onEdit={() => router.push(`/miembros/${id}/editar`)}
        onCommunicate={() => router.push(`/comunicaciones/nueva?mode=manual&members=${id}`)}
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen(o => !o)}
        onMenuClose={() => setMenuOpen(false)}
        onDeactivate={() => setMenuOpen(false)}
        onMerge={() => setMenuOpen(false)}
      />

      {/* ── Tab bar ── */}
      <div
        className="sticky top-0 z-10 rounded-2xl bg-surface-card overflow-x-auto"
        style={{ boxShadow: 'var(--shadow-md)' }}
      >
        <div className="flex min-w-max">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => changeTab(tab.id)}
              className={cn(
                'px-5 py-3.5 text-sm whitespace-nowrap transition-all relative',
                activeTab === tab.id
                  ? 'text-navy font-medium'
                  : 'text-navy-light/50 hover:text-navy'
              )}
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-coral rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}

      {/* TAB: Resumen */}
      {activeTab === 'resumen' && (
        <MemberSummaryTab
          member={member}
          currentStudyEntry={currentStudyEntry}
          currentWeek={currentWeek}
          activeService={activeService}
          lastStudyEntry={lastStudyEntry}
        />
      )}

      {/* TAB: Info Personal */}
      {activeTab === 'personal' && (
        <MemberPersonalTab member={member} />
      )}

      {/* TAB: Participación */}
      {activeTab === 'participacion' && (
        <MemberParticipationTab
          openSections={openSections}
          onToggleSection={toggleSection}
          estudiosTable={estudiosTable}
          servicioTable={servicioTable}
          eventosTable={eventosTable}
          donacionesTable={donacionesTable}
          visibleEstudios={visibleEstudios}
          visibleServicio={visibleServicio}
          visibleEventos={visibleEventos}
          visibleDonaciones={visibleDonaciones}
          onLoadMoreEstudios={() => setVisibleEstudios(v => v + LOAD_MORE)}
          onLoadMoreServicio={() => setVisibleServicio(v => v + LOAD_MORE)}
          onLoadMoreEventos={() => setVisibleEventos(v => v + LOAD_MORE)}
          onLoadMoreDonaciones={() => setVisibleDonaciones(v => v + LOAD_MORE)}
          hasFinanceRole={hasFinanceRole}
          revealDonations={revealDonations}
          onToggleRevealDonations={() => setRevealDonations(r => !r)}
          donationsCount={member.donations.length}
        />
      )}

      {/* TAB: Familia */}
      {activeTab === 'familia' && (
        <MemberFamilyTab member={member} />
      )}

      {/* TAB: Pase Digital */}
      {activeTab === 'pase' && (
        <MemberWalletTab member={member} />
      )}
    </div>
  )
}
