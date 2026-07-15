'use client'

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ChevronLeft, Minus, Plus, ShoppingCart, Check, Info, Lock, Loader2 } from 'lucide-react'
import { AccessDenied } from '@/components/shared/AccessDenied'
import {
  isVacancyRequestWindowOpen,
  VACANCY_REQUEST_WINDOW_TOOLTIP,
} from '@/lib/servers/request-window'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'
const labelCls = 'text-[11px] tracking-widest uppercase text-navy-light/60 font-display'

type FlatPosition = {
  id: string
  title: string
  is_active: boolean | null
  area: { id: string; name: string } | null
}

type Committee = { id: string; name: string }

function SolicitarVacantesContent() {
  const params = useSearchParams()
  const preselectedCommittee = params.get('comite') ?? ''

  const [scope, setScope] = useState<{ all: boolean; ids: string[] } | null>(null)
  const [positions, setPositions] = useState<FlatPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [committeeId, setCommitteeId] = useState(preselectedCommittee)
  const [cart, setCart] = useState<Record<string, number>>({}) // position_id → cantidad

  // Datos de la vacante (compartidos por todos los puestos del carrito).
  const [schedule, setSchedule] = useState('')
  const [commitment, setCommitment] = useState('')
  const [location, setLocation] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [notes, setNotes] = useState('')
  const [featured, setFeatured] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ rows: number; slots: number; status: 'creado' | 'aprobado' } | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/servers/manageable-committees').then(r => (r.ok ? r.json() : Promise.reject())),
      fetch('/api/servers/positions').then(r => (r.ok ? r.json() : Promise.reject())),
    ])
      .then(([sc, pos]: [{ all: boolean; ids: string[] }, FlatPosition[]]) => {
        setScope(sc)
        setPositions(Array.isArray(pos) ? pos : [])
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }, [])

  // Comités con al menos un puesto activo, según el alcance del usuario.
  const committees = useMemo<Committee[]>(() => {
    const m = new Map<string, string>()
    for (const p of positions) {
      if (p.is_active === false || !p.area) continue
      if (!scope?.all && !(scope?.ids ?? []).includes(p.area.id)) continue
      m.set(p.area.id, p.area.name)
    }
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [positions, scope])

  // Líder de comité = alcance NO global → aplica la ventana de tiempo.
  const isLeader = !!scope && !scope.all
  const windowOpen = isVacancyRequestWindowOpen()
  const canSend = !isLeader || windowOpen

  // Si el líder gestiona un solo comité, queda fijo y bloqueado.
  const lockedCommittee = isLeader && committees.length === 1 ? committees[0] : null
  useEffect(() => {
    if (lockedCommittee && committeeId !== lockedCommittee.id) setCommitteeId(lockedCommittee.id)
  }, [lockedCommittee, committeeId])

  const committeePositions = useMemo(
    () => positions
      .filter(p => p.is_active !== false && p.area?.id === committeeId)
      .sort((a, b) => a.title.localeCompare(b.title)),
    [positions, committeeId],
  )

  const totalSlots = useMemo(() => Object.values(cart).reduce((s, n) => s + n, 0), [cart])

  const setQty = useCallback((positionId: string, delta: number) => {
    setCart(prev => {
      const next = Math.max(0, (prev[positionId] ?? 0) + delta)
      const copy = { ...prev }
      if (next === 0) delete copy[positionId]
      else copy[positionId] = next
      return copy
    })
  }, [])

  // Al cambiar de comité, limpiamos el carrito (los puestos son de otro comité).
  function onCommitteeChange(id: string) {
    setCommitteeId(id)
    setCart({})
    setError(null)
  }

  async function submit() {
    if (saving || totalSlots === 0 || !committeeId || !canSend) return
    setSaving(true)
    setError(null)
    try {
      const items = Object.entries(cart).map(([position_id, quantity]) => ({ position_id, quantity }))
      const res = await fetch('/api/servers/vacancies/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          committee_id: committeeId,
          items,
          schedule: schedule.trim() || undefined,
          commitment: commitment.trim() || undefined,
          location: location.trim() || undefined,
          notes: notes.trim() || undefined,
          expires_at: expiresAt || undefined,
          is_featured: featured,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudieron enviar las vacantes.')
      setSaved({ rows: data.rows, slots: data.slots, status: data.status })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-60 text-navy-light/60">
        <Loader2 size={20} className="animate-spin" />
      </div>
    )
  }

  if (loadError || (scope && !scope.all && committees.length === 0)) {
    return <AccessDenied />
  }

  if (saved) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <div className="text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-teal-soft/30 flex items-center justify-center mx-auto">
            <Check size={24} className="text-teal-deep" />
          </div>
          <div>
            <p className="text-xl font-bold text-navy font-display">
              {saved.status === 'aprobado' ? 'Vacantes publicadas' : 'Vacantes enviadas'}
            </p>
            <p className="mt-1 text-sm text-navy-light/70 font-body">
              {saved.slots} vacante{saved.slots !== 1 ? 's' : ''} en {saved.rows} puesto{saved.rows !== 1 ? 's' : ''}.
              {saved.status === 'aprobado'
                ? ' Ya quedaron visibles para que los miembros apliquen.'
                : ' Quedaron pendientes de revisión.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => { setSaved(null); setCart({}) }}
              className="rounded-full border border-[var(--outline-variant)] px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
            >
              Solicitar más
            </button>
            <Link
              href="/servidores/vacantes/solicitudes"
              className="rounded-full bg-coral px-5 py-2 text-sm text-white hover:bg-coral-deep transition-colors font-body"
            >
              Ver solicitudes
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Volver */}
      <Link
        href="/servidores/vacantes"
        className="inline-flex items-center gap-1.5 text-[13px] text-navy-light/60 hover:text-navy-light transition-colors font-body"
      >
        <ChevronLeft size={15} /> Puestos de Servicio
      </Link>

      {/* Header */}
      <div className="rounded-2xl bg-navy px-5 sm:px-6 py-5 shadow-[var(--shadow-md)]">
        <h1 className="text-2xl text-white font-display font-extrabold tracking-[-0.02em]">Solicitar vacantes</h1>
        <p className="mt-1 text-sm text-white/70 font-body">
          Elegí el comité y sumá la cantidad de cupos que necesitás por puesto.
        </p>
      </div>

      {/* Sección 1: Comité */}
      <section className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-3">
        <p className="text-[10px] uppercase tracking-wider text-navy-light/70 font-display">Comité</p>
        {lockedCommittee ? (
          <div className="inline-flex items-center gap-2 rounded-xl bg-surface-low px-3.5 py-2.5">
            <Lock size={14} className="text-navy-light/50" />
            <span className="text-sm font-medium text-navy font-body">{lockedCommittee.name}</span>
          </div>
        ) : (
          <select
            value={committeeId}
            onChange={e => onCommitteeChange(e.target.value)}
            aria-label="Seleccionar comité"
            className="w-full sm:max-w-md rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
          >
            <option value="">Seleccionar comité…</option>
            {committees.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </section>

      {/* Sección 2: Puestos del comité (carrito) */}
      {committeeId && (
        <section className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-wider text-navy-light/70 font-display">
              Puestos del comité
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-low px-3 py-1 text-[12px] text-navy-light/70 font-body">
              <ShoppingCart size={13} /> {totalSlots} vacante{totalSlots !== 1 ? 's' : ''}
            </span>
          </div>

          {committeePositions.length === 0 ? (
            <p className="text-sm text-navy-light/60 font-body py-6 text-center">
              Este comité no tiene puestos activos.
            </p>
          ) : (
            <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {committeePositions.map(p => {
                const qty = cart[p.id] ?? 0
                return (
                  <li
                    key={p.id}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors',
                      qty > 0 ? 'border-coral/40 bg-coral/5' : 'border-[var(--outline-variant)]',
                    )}
                  >
                    <span className="text-sm font-medium text-navy font-body min-w-0 truncate">{p.title}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setQty(p.id, -1)}
                        disabled={qty === 0}
                        aria-label={`Restar vacante de ${p.title}`}
                        className="h-10 w-10 rounded-full border border-[var(--outline-variant)] flex items-center justify-center text-navy-light hover:bg-surface-low active:scale-95 transition disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Minus size={18} />
                      </button>
                      <span className="w-8 text-center text-base font-bold text-navy font-display tabular-nums" aria-live="polite">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQty(p.id, 1)}
                        aria-label={`Sumar vacante de ${p.title}`}
                        className="h-10 w-10 rounded-full bg-coral/15 text-coral-deep flex items-center justify-center hover:bg-coral/25 active:scale-95 transition"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {/* Sección 3: Datos de la vacante (comunes al carrito) */}
      {committeeId && totalSlots > 0 && (
        <section className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-3">
          <p className="text-[10px] uppercase tracking-wider text-navy-light/70 font-display">Detalles de la vacante</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className={labelCls}>Ubicación / sede</label>
              <input className={inputCls} placeholder="Sede / lugar (opcional)" value={location} onChange={e => setLocation(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Horario</label>
              <input className={inputCls} placeholder="Ej. Domingos 8am–12pm" value={schedule} onChange={e => setSchedule(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Compromiso esperado</label>
              <input className={inputCls} placeholder="Ej. 2 domingos al mes" value={commitment} onChange={e => setCommitment(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Expira</label>
              <input type="date" className={inputCls} value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 pb-1 self-end cursor-pointer">
              <input type="checkbox" className="accent-coral" checked={featured} onChange={e => setFeatured(e.target.checked)} />
              <span className="text-sm text-navy font-body">Destacada</span>
            </label>
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Justificación / notas internas (opcional)</label>
            <textarea className={cn(inputCls, 'resize-none')} rows={3} placeholder="¿Por qué se necesita?" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </section>
      )}

      {/* Enviar */}
      <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-navy-light/70 font-body">
            Total: <strong className="text-navy">{totalSlots}</strong> vacante{totalSlots !== 1 ? 's' : ''}
          </span>
          <span
            tabIndex={0}
            role="img"
            aria-label={VACANCY_REQUEST_WINDOW_TOOLTIP}
            className="group/info relative inline-flex opacity-70 outline-none"
          >
            <Info size={14} />
            <span
              role="tooltip"
              className="pointer-events-none absolute left-1/2 bottom-full z-[60] mb-1.5 hidden w-64 -translate-x-1/2 rounded-lg bg-navy px-3 py-2 text-[11px] font-normal leading-snug text-white shadow-[var(--shadow-lg)] font-body group-hover/info:block group-focus-within/info:block"
            >
              {VACANCY_REQUEST_WINDOW_TOOLTIP}
            </span>
          </span>
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-1">
          <button
            type="button"
            onClick={submit}
            disabled={saving || totalSlots === 0 || !committeeId || !canSend}
            title={!canSend ? VACANCY_REQUEST_WINDOW_TOOLTIP : undefined}
            className={cn(
              'rounded-full px-5 py-2.5 text-sm text-white transition-colors font-body inline-flex items-center justify-center gap-2',
              saving || totalSlots === 0 || !committeeId || !canSend
                ? 'bg-navy-light/20 cursor-not-allowed'
                : 'bg-coral hover:bg-coral-deep',
            )}
          >
            {saving ? <><Loader2 size={15} className="animate-spin" /> Enviando…</> : 'Enviar vacantes'}
          </button>
          {!canSend && (
            <p className="text-[11px] text-coral font-body text-center sm:text-right max-w-xs">
              {VACANCY_REQUEST_WINDOW_TOOLTIP}
            </p>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-coral font-body">{error}</p>}
    </div>
  )
}

export default function SolicitarVacantesPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-[var(--fg-muted)]">Cargando…</div>}>
      <SolicitarVacantesContent />
    </Suspense>
  )
}
