'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { type Vacancy } from '@/types/server'
import type { DbVacancy } from '@/lib/supabase/queries/servers'
import { toDomainVacancy } from '@/lib/servers/adapter'
import { useAuth } from '@/hooks/useAuth'
import { SERVICE_ADMIN_ROLES, STAFF_IMPORT_ROLES } from '@/lib/auth/roles'
import { cn } from '@/lib/utils'
import { Plus, Users, ChevronDown, Upload, Search, MapPin, Clock, Calendar, Pencil, XCircle, Eye, FilePlus2 } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Modal } from '@/components/shared/Modal'
import { useToast } from '@/components/shared/Toast'
import { ApplyToVacancyButton } from '@/components/servers/ApplyToVacancyButton'

export default function VacantesPage() {
  const { hasRole } = useAuth()
  const isAdmin = hasRole(...SERVICE_ADMIN_ROLES) // ve acciones administrativas
  // Importar puestos/vacantes: solo admin + coordinación de staff (puntos 4 y 6).
  const canImport = hasRole('admin', ...STAFF_IMPORT_ROLES)
  // Solicitar: admin + coordinación de staff + coordinadores/líderes de comité
  // (el backend valida el comité y excluye dirección sin comité).
  const canRequest = hasRole('admin', ...STAFF_IMPORT_ROLES, 'lider_comite')

  const [vacancies, setVacancies] = useState<Vacancy[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const refetch = useCallback(() => {
    setError(null); setLoading(true)
    // ?published=1: solo puestos disponibles, abierto a cualquier miembro.
    fetch('/api/servers/vacancies?published=1')
      .then(r => { if (!r.ok) throw new Error('Error cargando puestos'); return r.json() })
      .then((d: DbVacancy[]) => setVacancies((Array.isArray(d) ? d : []).map(toDomainVacancy)))
      .catch(e => setError(e instanceof Error ? e.message : 'Error desconocido'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { refetch() }, [refetch])

  const [qPuesto, setQPuesto] = useState('')
  const [committeeFilter, setCommitteeFilter] = useState('all')
  const [areaFilter, setAreaFilter] = useState('all') // "ubicación" (área del comité)
  const [open, setOpen] = useState<Set<string>>(new Set())

  // Opciones de comité y ubicación: solo los que tienen al menos un puesto.
  const committeeOptions = useMemo(() => {
    const m = new Map<string, string>()
    vacancies.forEach(v => m.set(v.committee_id, v.committee_name))
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [vacancies])
  const areaOptions = useMemo(
    () => Array.from(new Set(vacancies.map(v => v.area).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [vacancies],
  )

  const filtered = useMemo(() => {
    const q = qPuesto.trim().toLowerCase()
    return vacancies.filter(v =>
      (q === '' || v.title.toLowerCase().includes(q)) &&
      (committeeFilter === 'all' || v.committee_id === committeeFilter) &&
      (areaFilter === 'all' || v.area === areaFilter),
    )
  }, [vacancies, qPuesto, committeeFilter, areaFilter])

  // Agrupar por comité para los acordeones.
  const groups = useMemo(() => {
    const m = new Map<string, { id: string; name: string; area: string; items: Vacancy[] }>()
    for (const v of filtered) {
      const g = m.get(v.committee_id) ?? { id: v.committee_id, name: v.committee_name, area: v.area, items: [] }
      g.items.push(v)
      m.set(v.committee_id, g)
    }
    return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [filtered])

  function toggle(id: string) {
    setOpen(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-navy px-6 py-5 flex items-start justify-between gap-4 shadow-[var(--shadow-md)]">
        <div>
          <h1 className="text-2xl text-white font-display font-extrabold tracking-[-0.02em]">Puestos de Servicio</h1>
          <p className="mt-1 text-sm text-white/70 font-body">
            {filtered.length} puesto{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        {(canImport || canRequest) && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {canImport && (
              <Link href="/servidores/admin/importar-vacantes" className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10 transition-all duration-150 font-body">
                <Upload size={14} /> Importar vacantes
              </Link>
            )}
            {canRequest && (
              <>
                <Link href="/servidores/puestos/solicitar" className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10 transition-all duration-150 font-body">
                  <FilePlus2 size={14} /> Solicitar puesto nuevo
                </Link>
                <Link href="/servidores/vacantes/solicitar" className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-all duration-150 font-body">
                  <Plus size={14} /> Solicitar vacantes
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      {/* Búsquedas: por puesto, por comité, por ubicación */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-2 rounded-xl bg-surface-card px-3 py-2 shadow-[var(--shadow-sm)]">
          <Search size={16} className="text-navy-light/70 shrink-0" aria-hidden />
          <input
            value={qPuesto}
            onChange={e => setQPuesto(e.target.value)}
            placeholder="Buscar por puesto…"
            aria-label="Buscar por puesto"
            className="flex-1 bg-transparent text-sm text-navy placeholder-navy-light/40 outline-none font-body min-w-0"
          />
        </div>
        <select
          value={committeeFilter}
          onChange={e => setCommitteeFilter(e.target.value)}
          aria-label="Filtrar por comité"
          className="rounded-xl bg-surface-card px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 shadow-[var(--shadow-sm)] font-body"
        >
          <option value="all">Todos los comités</option>
          {committeeOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={areaFilter}
          onChange={e => setAreaFilter(e.target.value)}
          aria-label="Filtrar por ubicación"
          className="rounded-xl bg-surface-card px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 shadow-[var(--shadow-sm)] font-body"
        >
          <option value="all">Todas las ubicaciones</option>
          {areaOptions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Acordeones por comité */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16 text-navy-light/70">
            <div className="h-8 w-8 rounded-full border-2 border-coral/30 border-t-coral animate-spin" aria-hidden />
            <p className="text-sm font-body">Cargando puestos…</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)]"><ErrorState message={error} onRetry={refetch} /></div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)]">
            <EmptyState icon={Users} title="No hay puestos con esos filtros" />
          </div>
        ) : groups.map(g => {
          const isOpen = open.has(g.id)
          return (
            <div key={g.id} className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] overflow-hidden">
              <button
                onClick={() => toggle(g.id)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-surface-low transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-base font-bold text-navy font-display truncate">{g.name}</p>
                  <div className="mt-0.5 flex items-center gap-3 text-[12px] text-navy-light/70 font-body">
                    {g.area && <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden /> {g.area}</span>}
                    <span>{g.items.length} puesto{g.items.length !== 1 ? 's' : ''} disponible{g.items.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <ChevronDown size={18} className={cn('shrink-0 text-navy-light/50 transition-transform', isOpen && 'rotate-180')} aria-hidden />
              </button>

              {isOpen && (
                <div className="border-t border-[var(--outline-variant)] divide-y divide-[var(--outline-variant)]">
                  {g.items.map(v => {
                    const slotsLeft = v.slots_total - v.slots_filled
                    return (
                      <div key={v.id} className="p-5 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-base font-bold text-navy font-display tracking-[-0.01em]">{v.title}</p>
                          <span className="shrink-0 rounded-full bg-surface-low px-2.5 py-1 text-[12px] text-navy-light/70 font-body">
                            {slotsLeft} cupo{slotsLeft !== 1 ? 's' : ''}
                          </span>
                        </div>

                        {v.description && <p className="text-[13px] text-navy-light/70 leading-relaxed font-body">{v.description}</p>}

                        {v.functions.length > 0 && (
                          <div>
                            <p className="text-[11px] tracking-widest uppercase text-navy-light/70 font-display mb-1">¿Qué harás?</p>
                            <ul className="space-y-0.5">
                              {v.functions.map((f, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-[13px] text-navy-light/70 font-body">
                                  <span className="text-coral mt-0.5" aria-hidden>•</span>{f}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {(v.schedule || v.commitment) && (
                          <div className="flex items-center gap-4 flex-wrap text-[12px] text-navy-light/70 font-body">
                            {v.schedule && <span className="inline-flex items-center gap-1"><Calendar size={12} aria-hidden /> {v.schedule}</span>}
                            {v.commitment && <span className="inline-flex items-center gap-1"><Clock size={12} aria-hidden /> {v.commitment}</span>}
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
                          <ApplyToVacancyButton vacancyId={v.id} />
                          {isAdmin && (
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link href={`/servidores/vacantes/${v.id}`} className="inline-flex items-center gap-1 rounded-full border border-[var(--outline-variant)] px-3 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors font-body">
                                <Eye size={12} aria-hidden /> Ver aplicaciones{v.application_count ? ` (${v.application_count})` : ''}
                              </Link>
                              <Link href={`/servidores/vacantes/${v.id}/editar`} className="inline-flex items-center gap-1 rounded-full border border-[var(--outline-variant)] px-3 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors font-body">
                                <Pencil size={12} aria-hidden /> Editar
                              </Link>
                              <CloseVacancyButton vacancyId={v.id} onClosed={refetch} />
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Cerrar puesto (solo admin). PUT status=cerrada; recarga la lista.
function CloseVacancyButton({ vacancyId, onClosed }: { vacancyId: string; onClosed: () => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  async function close() {
    if (busy) return
    setConfirmOpen(false)
    setBusy(true)
    try {
      const res = await fetch(`/api/servers/vacancies/${vacancyId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cerrada' }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onClosed()
    } catch (e) {
      console.error('No se pudo cerrar el puesto:', e)
      toast('No se pudo cerrar el puesto. Intentá de nuevo.', 'error')
      setBusy(false)
    }
  }
  return (
    <>
      <button onClick={() => setConfirmOpen(true)} disabled={busy} className="inline-flex items-center gap-1 rounded-full border border-[var(--outline-variant)] px-3 py-1.5 text-[12px] text-coral hover:bg-coral/5 transition-colors disabled:opacity-50 font-body">
        <XCircle size={12} aria-hidden /> {busy ? 'Cerrando…' : 'Cerrar'}
      </button>
      {confirmOpen && (
        <Modal onClose={() => setConfirmOpen(false)} titleId="cerrar-puesto-title" width={384}>
          <div className="p-6 space-y-4">
            <div>
              <p id="cerrar-puesto-title" className="text-base font-bold text-navy font-display">¿Cerrar este puesto?</p>
              <p className="text-[13px] text-navy-light/70 mt-1 leading-relaxed font-body">
                Dejará de estar disponible para aplicar. Podés volver a publicarlo más adelante desde la edición del puesto.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-xl border border-[var(--outline-variant)] py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
              >
                Cancelar
              </button>
              <button
                onClick={close}
                className="flex-1 rounded-xl bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body"
              >
                Cerrar puesto
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
