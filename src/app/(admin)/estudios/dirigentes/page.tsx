'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useStudies } from '@/hooks/useStudies'
import { ACTIVE_SEDES, HISTORICAL_SEDES } from '@/data/mock-sedes'
import { mockMembers } from '@/data/mock-members'
import { LeaderCard } from '@/components/studies/LeaderCard'
import { StudyTypeBadge } from '@/components/studies/StudyTypeBadge'
import { cn } from '@/lib/utils'
import { Plus, X, ChevronRight, Search } from 'lucide-react'

type ModalStep = 'search' | 'studies'

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

function NewLeaderModal({ onClose }: { onClose: () => void }) {
  const { studyTypes: STUDY_TYPES } = useStudies()
  const [modalStep, setModalStep] = useState<ModalStep>('search')
  const [query, setQuery] = useState('')
  const [selectedMember, setSelectedMember] = useState('')
  const [selectedStudies, setSelectedStudies] = useState<string[]>([])
  const [done, setDone] = useState(false)

  const memberResults = mockMembers.filter(m =>
    `${m.first_name} ${m.last_name}`.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 6)

  const chosenMember = mockMembers.find(m => m.id === selectedMember)

  function toggleStudy(code: string) {
    setSelectedStudies(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    )
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-navy-ink/50 backdrop-blur-sm" onClick={onClose} />
        <div
          className="relative rounded-2xl p-6 max-w-sm w-full mx-4 text-center space-y-3"
          style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-lg)' }}
        >
          <p className="text-lg font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
            Dirigente registrado
          </p>
          <p className="text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
            {chosenMember?.first_name} fue agregado como dirigente con {selectedStudies.length} estudios cualificados.
          </p>
          <button onClick={onClose} className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy-ink/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative rounded-2xl p-5 max-w-md w-full mx-4 space-y-4"
        style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-lg)' }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
            {modalStep === 'search' ? 'Nuevo dirigente' : 'Cualificaciones'}
          </h3>
          <button onClick={onClose} className="text-navy-light/50 hover:text-navy transition-colors">
            <X size={18} />
          </button>
        </div>

        {modalStep === 'search' && (
          <>
            <div className="flex items-center gap-2 rounded-xl bg-surface-low px-3 py-2">
              <Search size={14} className="text-navy-light/40" />
              <input
                autoFocus
                className="flex-1 bg-transparent text-sm text-navy outline-none"
                placeholder="Buscar miembro..."
                style={{ fontFamily: 'var(--font-body)' }}
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {memberResults.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMember(m.id)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors',
                    selectedMember === m.id ? 'bg-coral/10 ring-1 ring-coral/30' : 'hover:bg-surface-low'
                  )}
                >
                  <div className="h-8 w-8 rounded-full bg-navy/10 flex items-center justify-center text-[10px] font-bold text-navy shrink-0">
                    {getInitials(`${m.first_name} ${m.last_name}`)}
                  </div>
                  <div>
                    <p className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                      {m.first_name} {m.last_name}
                    </p>
                    <p className="text-[11px] text-navy-light/50">{m.sede} · {m.age} años</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="rounded-xl border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors" style={{ borderColor: 'var(--outline-variant)' }}>
                Cancelar
              </button>
              <button
                disabled={!selectedMember}
                onClick={() => setModalStep('studies')}
                className="inline-flex items-center gap-1 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40"
              >
                Siguiente <ChevronRight size={14} />
              </button>
            </div>
          </>
        )}

        {modalStep === 'studies' && (
          <>
            <p className="text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
              Selecciona los estudios que <strong className="text-navy">{chosenMember?.first_name}</strong> puede impartir:
            </p>
            <div className="space-y-3">
              {['niveles', 'inicial', 'intermedia'].map(stage => (
                <div key={stage}>
                  <p className="text-[10px] uppercase tracking-widest text-navy-light/40 mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>
                    {stage === 'niveles' ? 'Niveles' : stage === 'inicial' ? 'Etapa Inicial' : 'Etapa Intermedia'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {STUDY_TYPES.filter(s => s.stage === stage).map(s => (
                      <button
                        key={s.id}
                        onClick={() => toggleStudy(s.code)}
                        className={cn(
                          'rounded-lg px-2.5 py-1 text-[11px] font-medium border transition-all',
                          selectedStudies.includes(s.code)
                            ? 'bg-navy text-white border-navy'
                            : 'text-navy-light hover:bg-surface-low'
                        )}
                        style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-display)' }}
                      >
                        {s.code}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between gap-2">
              <button onClick={() => setModalStep('search')} className="rounded-xl border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors" style={{ borderColor: 'var(--outline-variant)' }}>
                ← Atrás
              </button>
              <button
                disabled={selectedStudies.length === 0}
                onClick={() => setDone(true)}
                className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40"
              >
                Guardar dirigente
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function DirigentesPage() {
  const { leaders: MOCK_LEADERS, studyTypes: STUDY_TYPES } = useStudies()
  const [filterStatus, setFilterStatus] = useState('')
  const [filterZone, setFilterZone] = useState('')
  const [filterStudy, setFilterStudy] = useState('')
  const [search, setSearch] = useState('')
  const [showNewLeader, setShowNewLeader] = useState(false)

  const filtered = useMemo(() => {
    return MOCK_LEADERS.filter(l => {
      if (filterStatus && l.availability_status !== filterStatus) return false
      if (filterZone && !l.zone_preference.includes(filterZone)) return false
      if (filterStudy && !l.qualified_studies.includes(filterStudy)) return false
      return true
    })
  }, [filterStatus, filterZone, filterStudy])

  const filteredLeaders = useMemo(() => {
    if (!search.trim()) return filtered
    const q = search.toLowerCase().trim()
    const searchNorm = q.replace(/[-\s]/g, '')
    return filtered.filter(leader => {
      const fullName = leader.member_name.toLowerCase()
      const cedula = ((leader as Record<string, unknown>).cedula as string ?? '').replace(/[-\s]/g, '')
      return fullName.includes(q) || cedula.includes(searchNorm)
    })
  }, [filtered, search])

  const inputCls = 'rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

  return (
    <div className="space-y-5">
      {showNewLeader && <NewLeaderModal onClose={() => setShowNewLeader(false)} />}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-2xl text-navy"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            Dirigentes
          </h1>
          <p className="mt-1 text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
            {MOCK_LEADERS.length} dirigentes registrados
          </p>
        </div>
        <button
          onClick={() => setShowNewLeader(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          <Plus size={14} /> Nuevo dirigente
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3" style={{ fontFamily: 'var(--font-body)' }}>
        {/* Search input */}
        <div className="relative flex items-center">
          <Search size={13} className="absolute left-3 text-navy-light/40 pointer-events-none" />
          <input
            className={`${inputCls} pl-8 pr-8`}
            style={{ minWidth: 220 }}
            placeholder="Buscar por nombre o cédula..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 text-navy-light/40 hover:text-navy transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <select
          className={inputCls}
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="available">Disponible</option>
          <option value="assigned">Asignado</option>
          <option value="resting">Descansando</option>
        </select>

        <select
          className={inputCls}
          value={filterZone}
          onChange={e => setFilterZone(e.target.value)}
        >
          <option value="">Todas las zonas</option>
          <optgroup label="── Sedes activas ──">
            {ACTIVE_SEDES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </optgroup>
          <optgroup label="── Sedes históricas ──">
            {HISTORICAL_SEDES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </optgroup>
        </select>

        <select
          className={inputCls}
          value={filterStudy}
          onChange={e => setFilterStudy(e.target.value)}
        >
          <option value="">Cualquier estudio</option>
          {STUDY_TYPES.map(s => <option key={s.id} value={s.code}>{s.code} — {s.name}</option>)}
        </select>
      </div>

      {/* Result count */}
      {search.trim() && (
        <p className="text-[12px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
          {filteredLeaders.length} resultado{filteredLeaders.length !== 1 ? 's' : ''} para &ldquo;{search}&rdquo;
        </p>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredLeaders.map(leader => (
          <Link key={leader.id} href={`/estudios/dirigentes/${leader.id}`} className="block">
            <LeaderCard leader={leader} />
          </Link>
        ))}
        {filteredLeaders.length === 0 && (
          <div className="col-span-full rounded-2xl p-12 text-center" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <p className="text-sm font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
              No se encontraron dirigentes
            </p>
            <p className="mt-1 text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
              {search.trim()
                ? `No hay resultados para "${search}"`
                : 'No hay dirigentes con esos filtros.'
              }
            </p>
            {search.trim() && (
              <button
                onClick={() => setSearch('')}
                className="mt-3 rounded-full border px-3 py-1.5 text-sm text-navy-light hover:bg-surface-low transition-colors"
                style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
              >
                Limpiar búsqueda
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
