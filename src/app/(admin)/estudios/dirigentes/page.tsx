'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useDirigentes } from '@/hooks/useDirigentes'
import { useStudyPlans } from '@/hooks/useStudyPlans'
import { useClientPagination } from '@/hooks/useClientPagination'
import { useAuth } from '@/hooks/useAuth'
import { StudyTypeBadge } from '@/components/studies/StudyTypeBadge'
import { LoadMoreFooter } from '@/components/shared/LoadMoreFooter'
import type { Dirigente } from '@/lib/dirigentes'
import { cn } from '@/lib/utils'
import { Search, ChevronRight, Users, Plus } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { MemberCombobox, type MemberHit } from '@/components/shared/MemberCombobox'
import { getInitials } from '@/lib/format'

const ESTADO_FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'activo', label: 'Activos' },
  { key: 'inactivo', label: 'Inactivos' },
] as const

function DirigenteCard({ d, onClick }: { d: Dirigente; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl bg-surface-card shadow-[var(--shadow-md)] p-4 hover:shadow-[var(--shadow-lg)] transition-shadow"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy text-xs font-display font-extrabold">
          {getInitials(d.member_name) || '—'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-navy font-body font-medium truncate">{d.member_name || 'Sin nombre'}</p>
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-medium font-body',
              d.status === 'activo' ? 'bg-[rgba(61,185,122,0.12)] text-[#3DB97A]' : 'bg-surface-low text-navy-light/60',
            )}>
              {d.status === 'activo' ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <p className="text-xs text-navy-light/60 font-body mt-0.5">
            {d.total_grupos} grupo{d.total_grupos === 1 ? '' : 's'} liderado{d.total_grupos === 1 ? '' : 's'} · {d.total_activos} activo{d.total_activos === 1 ? '' : 's'}
          </p>
        </div>
        <ChevronRight size={16} className="text-navy-light/60 shrink-0" />
      </div>

      {/* Estudios activos */}
      {d.estudios_activos.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[10px] uppercase tracking-widest text-navy-light/60 font-display">Dando ahora</p>
          {d.estudios_activos.slice(0, 3).map(g => (
            <div key={g.group_id} className="flex items-center gap-2 text-xs">
              <StudyTypeBadge code={g.plan_code} size="sm" />
              <span className="text-navy-light/60 font-body truncate flex-1">{g.group_name}</span>
              <span className="flex items-center gap-0.5 text-navy-light/60 font-body shrink-0">
                <Users size={11} /> {g.students_count}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Historial */}
      {d.estudios_completados.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1 items-center">
          {[...new Set(d.estudios_completados.map(g => g.plan_code))].slice(0, 6).map(code => (
            <StudyTypeBadge key={code} code={code} size="sm" />
          ))}
          <span className="text-[11px] text-navy-light/60 font-body">
            · {d.estudios_completados.length} completado{d.estudios_completados.length === 1 ? '' : 's'}
          </span>
        </div>
      ) : d.estudios_activos.length === 0 ? (
        <p className="mt-3 text-[11px] text-navy-light/60 font-body">Sin estudios registrados</p>
      ) : null}
    </button>
  )
}

export default function DirigentesPage() {
  const router = useRouter()
  const { dirigentes, loading, refetch } = useDirigentes()
  const { studyTypes } = useStudyPlans()
  const { hasRole } = useAuth()
  const canAdd = hasRole('admin', 'coordinador_dirigentes')
  const [estado, setEstado] = useState<'todos' | 'activo' | 'inactivo'>('todos')
  const [tipo, setTipo] = useState('')
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  // Tipos de estudio que algún dirigente ha dado (para el filtro).
  const tiposDados = useMemo(() => {
    const set = new Set<string>()
    dirigentes.forEach(d => d.estudios_habilitados.forEach(c => set.add(c)))
    return studyTypes.filter(t => set.has(t.code))
  }, [dirigentes, studyTypes])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return dirigentes.filter(d => {
      if (estado !== 'todos' && d.status !== estado) return false
      if (tipo && !d.estudios_habilitados.includes(tipo)) return false
      if (q && !d.member_name.toLowerCase().includes(q)) return false
      return true
    })
  }, [dirigentes, estado, tipo, query])

  const counts = useMemo(() => ({
    activos: dirigentes.filter(d => d.status === 'activo').length,
    inactivos: dirigentes.filter(d => d.status === 'inactivo').length,
  }), [dirigentes])

  const { visible, shown, total, hasMore, loadMore } = useClientPagination(filtered, 15)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">Dirigentes</h1>
          <p className="text-sm text-navy-light/60 font-body">
            {counts.activos} activos · {counts.inactivos} inactivos (con historial)
          </p>
        </div>
        {canAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors font-body shrink-0"
          >
            <Plus size={14} /> Agregar dirigente
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {ESTADO_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setEstado(f.key)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-sm transition-colors font-body',
                estado === f.key ? 'bg-navy text-white' : 'bg-surface-low text-navy-light hover:bg-surface-container',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={tipo}
            onChange={e => setTipo(e.target.value)}
            className="rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body w-full sm:w-auto"
          >
            <option value="">Todos los estudios</option>
            {tiposDados.map(t => <option key={t.code} value={t.code}>{t.code} — {t.name}</option>)}
          </select>
          <div className="flex items-center gap-2 rounded-xl bg-surface-low px-3 py-2 w-full sm:w-56 focus-within:ring-1 focus-within:ring-coral/30">
            <Search size={15} className="text-navy-light/60 shrink-0" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar dirigente…"
              aria-label="Buscar dirigente"
              className="bg-transparent text-sm text-navy outline-none w-full font-body"
            />
          </div>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="py-16 text-center font-body">
          <div className="h-7 w-7 mx-auto mb-3 rounded-full border-2 border-navy-light/20 border-t-coral animate-spin" />
          <p className="text-sm text-navy-light/60">Cargando dirigentes…</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-navy-light/60 font-body">Sin dirigentes para los filtros aplicados</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visible.map(d => (
              <DirigenteCard key={d.member_id} d={d} onClick={() => router.push(`/estudios/dirigentes/${d.member_id}`)} />
            ))}
          </div>
          <LoadMoreFooter
            shown={shown}
            total={total}
            hasMore={hasMore}
            loading={false}
            onLoadMore={loadMore}
            noun="dirigentes"
            increment={15}
          />
        </>
      )}

      {showAdd && (
        <AddDirigenteModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); refetch() }} />
      )}
    </div>
  )
}

// ─── Modal: agregar dirigente ───────────────────────────────────────────────────
function AddDirigenteModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [picked, setPicked] = useState<MemberHit | null>(null)
  const [activo, setActivo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSave() {
    if (!picked) return
    setSaving(true)
    setErr(null)
    try {
      const res = await fetch('/api/studies/dirigentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: picked.id, active: activo }),
      })
      if (!res.ok) throw new Error('Error guardando')
      onSaved()
    } catch (e) {
      console.error(e)
      setErr('No se pudo agregar. Intentá de nuevo.')
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} titleId="agregar-dirigente-title" width={384}>
      <div className="p-6 space-y-4">
        <p id="agregar-dirigente-title" className="text-base font-bold text-navy font-display">Agregar dirigente</p>

        {!picked ? (
          <MemberCombobox
            autoFocus
            pageSize={6}
            placeholder="Buscar miembro por nombre, cédula…"
            onSelect={setPicked}
            secondaryText={m => (m.cedula ? `Cédula ${m.cedula}` : 'Sin cédula')}
          />
        ) : (
          <>
            <div className="rounded-xl bg-surface-low px-3 py-2.5">
              <p className="text-sm text-navy font-body">{picked.first_name} {picked.last_name}</p>
              <button onClick={() => setPicked(null)} className="mt-1 text-[11px] text-coral hover:underline font-body">Elegir otro</button>
            </div>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} className="accent-coral h-4 w-4 mt-0.5 rounded" />
              <span className="text-sm text-navy-light/80 font-body">
                Marcar como <strong className="text-navy">activo</strong>
                <span className="block text-[11px] text-navy-light/60">Si lo activás, se agrega al Comité de Dirigentes. Si no, queda como dirigente inactivo.</span>
              </span>
            </label>
          </>
        )}

        {err && <p className="text-sm text-coral font-body">{err}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body">Cancelar</button>
          <button onClick={handleSave} disabled={!picked || saving} className="flex-1 rounded-xl bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40 font-body">
            {saving ? 'Guardando…' : 'Agregar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
