'use client'

import { useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { notFound } from 'next/navigation'
import { useMember } from '@/hooks/useMember'
import { useStudies } from '@/hooks/useStudies'
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

  const { member, loading, notFound: isNotFound, error, refetch } = useMember(id || undefined)

  const [activeTab, setActiveTab] = useState('resumen')
  const [menuOpen, setMenuOpen] = useState(false)
  const [revealDonations, setRevealDonations] = useState(false)
  const [showAddStudy, setShowAddStudy] = useState(false)
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
      groupId: s.group_id,
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
      <div className="p-8 text-center text-coral font-body">
        Error cargando miembro: {error}
      </div>
    )
  }
  if (loading || !member) {
    return (
      <div className="p-8 text-center text-navy-light/50 font-body">
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
        className="sticky top-0 z-10 rounded-2xl bg-surface-card overflow-x-auto shadow-[var(--shadow-md)]"
      >
        <div className="flex min-w-max">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => changeTab(tab.id)}
              className={cn(
                'px-5 py-3.5 text-sm whitespace-nowrap transition-all relative font-body',
                activeTab === tab.id
                  ? 'text-navy font-medium'
                  : 'text-navy-light/50 hover:text-navy'
              )}
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
          onAddStudy={() => setShowAddStudy(true)}
        />
      )}

      {showAddStudy && (
        <AddStudyModal
          memberId={id}
          onClose={() => setShowAddStudy(false)}
          onAdded={() => { setShowAddStudy(false); refetch() }}
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

// ─── Modal: agregar estudio al historial (sin grupo) ────────────────────────────

function AddStudyModal({ memberId, onClose, onAdded }: {
  memberId: string
  onClose: () => void
  onAdded: () => void
}) {
  const { studyTypes } = useStudies()
  const [code, setCode] = useState('')
  const [date, setDate] = useState('')
  const [status, setStatus] = useState('completed')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'

  async function handleSave() {
    if (!code) { setErr('Seleccioná un estudio'); return }
    setSaving(true)
    setErr(null)
    try {
      const res = await fetch(`/api/members/${memberId}/studies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_code: code, date: date || null, status }),
      })
      if (!res.ok) throw new Error('Error guardando el estudio')
      onAdded()
    } catch (e) {
      console.error(e)
      setErr('No se pudo agregar el estudio. Intentá de nuevo.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-ink/60 backdrop-blur-sm" role="presentation" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-4 bg-surface-card shadow-[var(--shadow-lg)]">
        <p className="text-base font-bold text-navy font-display">Agregar estudio</p>
        <p className="text-[13px] text-navy-light/60 font-body -mt-2">
          Para estudios que la persona llevó sin un grupo en el sistema.
        </p>

        <div className="space-y-1">
          <label className="text-[11px] text-navy-light/60 font-display">Estudio *</label>
          <select className={inputCls} value={code} onChange={e => setCode(e.target.value)}>
            <option value="">Seleccionar…</option>
            {studyTypes.map(s => <option key={s.id} value={s.code}>{s.code} — {s.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] text-navy-light/60 font-display">Fecha</label>
            <input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-navy-light/60 font-display">Estado</label>
            <select className={inputCls} value={status} onChange={e => setStatus(e.target.value)}>
              <option value="completed">Aprobado</option>
              <option value="dropped">Reprobó</option>
              <option value="enrolled">En curso</option>
            </select>
          </div>
        </div>

        {err && <p className="text-sm text-coral font-body">{err}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40 font-body">
            {saving ? 'Guardando…' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  )
}
