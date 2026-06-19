'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useDirigentes } from '@/hooks/useDirigentes'
import { useStudyPlans } from '@/hooks/useStudyPlans'
import { useClientPagination } from '@/hooks/useClientPagination'
import { useAuth } from '@/hooks/useAuth'
import { useRowSelection } from '@/hooks/useRowSelection'
import { LoadMoreFooter } from '@/components/shared/LoadMoreFooter'
import { BulkActionBar } from '@/components/shared/BulkActionBar'
import { ActiveWarningModal } from '@/components/shared/ActiveWarningModal'
import type { Dirigente } from '@/lib/dirigentes'
import { cn } from '@/lib/utils'
import { Search, ChevronRight, Users, Plus, CheckCircle2, XCircle } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { MemberCombobox, type MemberHit } from '@/components/shared/MemberCombobox'
import { getInitials } from '@/lib/format'

const ESTADO_FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'activo', label: 'Activos' },
  { key: 'inactivo', label: 'Inactivos' },
] as const

type StudyBulk = { field: 'formation' | 'availability'; action: 'add' | 'remove' }

function DirigenteRow({
  d, selectable, selected, onToggleSelect, onOpen,
}: {
  d: Dirigente; selectable: boolean; selected: boolean
  onToggleSelect: () => void; onOpen: () => void
}) {
  return (
    <div className={cn('flex items-center gap-3 px-3 sm:px-4 py-3 border-b border-[var(--outline-variant)] transition-colors', selected ? 'bg-coral/5' : 'hover:bg-surface-low')}>
      {selectable && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Seleccionar ${d.member_name}`}
          className="accent-coral h-4 w-4 shrink-0"
        />
      )}
      <button onClick={onOpen} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy text-[11px] font-display font-extrabold">
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
            {d.estudios_activos.length > 0 && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-coral/10 text-coral font-body">
                Dando ahora
              </span>
            )}
          </div>
          <p className="text-xs text-navy-light/60 font-body mt-0.5 truncate">
            {d.total_grupos} grupo{d.total_grupos === 1 ? '' : 's'} · {d.total_activos} activo{d.total_activos === 1 ? '' : 's'}
            {d.estudios_activos.length > 0 && ` · ${d.estudios_activos.map(g => g.plan_code).slice(0, 3).join(', ')}`}
          </p>
        </div>
        <span className="hidden sm:flex items-center gap-1 text-xs text-navy-light/60 font-body shrink-0">
          <Users size={12} /> {d.estudios_activos.reduce((s, g) => s + g.students_count, 0)}
        </span>
        <ChevronRight size={16} className="text-navy-light/60 shrink-0" />
      </button>
    </div>
  )
}

export default function DirigentesPage() {
  const router = useRouter()
  const { dirigentes, loading, refetch } = useDirigentes()
  const { studyTypes } = useStudyPlans()
  const { hasRole } = useAuth()
  const canAdd = hasRole('admin', 'direccion', 'coordinador_dirigentes')
  const canBulk = hasRole('admin', 'direccion', 'coordinador_dirigentes', 'coordinador_estudios')
  const [estado, setEstado] = useState<'todos' | 'activo' | 'inactivo'>('todos')
  // Tres conceptos DISTINTOS, cada uno filtrable por tipo de estudio.
  const [dandoTipo, setDandoTipo] = useState('')      // grupo activo de ese estudio
  const [formadoTipo, setFormadoTipo] = useState('')  // capacitado/formado para darlo
  const [dispTipo, setDispTipo] = useState('')        // disponible (dispuesto a darlo)
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [confirm, setConfirm] = useState<{ active: boolean; ids: string[] } | null>(null)
  const [applying, setApplying] = useState(false)
  const [studyBulk, setStudyBulk] = useState<StudyBulk | null>(null)
  const [skippedWarn, setSkippedWarn] = useState<string[] | null>(null)


  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return dirigentes.filter(d => {
      if (estado !== 'todos' && d.status !== estado) return false
      if (dandoTipo && !d.estudios_activos.some(g => g.plan_code === dandoTipo)) return false
      if (formadoTipo && !d.formacion.includes(formadoTipo)) return false
      if (dispTipo && !d.disponibilidad.includes(dispTipo)) return false
      if (q && !d.member_name.toLowerCase().includes(q)) return false
      return true
    })
  }, [dirigentes, estado, dandoTipo, formadoTipo, dispTipo, query])

  const counts = useMemo(() => ({
    activos: dirigentes.filter(d => d.status === 'activo').length,
    inactivos: dirigentes.filter(d => d.status === 'inactivo').length,
  }), [dirigentes])

  const { visible, shown, total, hasMore, loadMore } = useClientPagination(filtered, 25)

  const filteredIds = useMemo(() => filtered.map(d => d.member_id), [filtered])
  const sel = useRowSelection(filteredIds)
  const nameById = useMemo(() => new Map(dirigentes.map(d => [d.member_id, d.member_name])), [dirigentes])

  async function applyBulkStatus() {
    if (!confirm || applying) return
    setApplying(true)
    try {
      const res = await fetch('/api/studies/dirigentes/bulk-status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_ids: confirm.ids, active: confirm.active }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { skipped?: string[] }
      sel.clear()
      setConfirm(null)
      if (data.skipped && data.skipped.length > 0) setSkippedWarn(data.skipped)
      refetch()
    } catch (e) {
      console.error('No se pudo aplicar el cambio masivo:', e)
    } finally {
      setApplying(false)
    }
  }

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
      <div className="space-y-3">
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
          <div className="flex-1" />
          <div className="flex items-center gap-2 rounded-xl bg-surface-low px-3 py-1.5 w-full sm:w-56 focus-within:ring-1 focus-within:ring-coral/30">
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

        {/* Tres filtros de estudio, etiquetados y separados (no se mezclan) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StudyFilter label="Dando ahora" hint="Tiene un grupo en curso de ese estudio" value={dandoTipo} onChange={setDandoTipo} options={studyTypes} />
          <StudyFilter label="Formado para darlo" hint="Capacitado para ese estudio (aunque no lo dé)" value={formadoTipo} onChange={setFormadoTipo} options={studyTypes} />
          <StudyFilter label="Disponibilidad" hint="Dispuesto a dar ese estudio ahora" value={dispTipo} onChange={setDispTipo} options={studyTypes} />
        </div>
      </div>

      {/* Barra de acciones masivas */}
      {canBulk && (
        <BulkActionBar
          count={sel.count}
          noun={sel.count === 1 ? 'dirigente seleccionado' : 'dirigentes seleccionados'}
          onClear={sel.clear}
          moreActions={[
            { label: 'Formación: agregar estudio',    onClick: () => setStudyBulk({ field: 'formation', action: 'add' }) },
            { label: 'Formación: quitar estudio',      onClick: () => setStudyBulk({ field: 'formation', action: 'remove' }) },
            { label: 'Disponibilidad: agregar estudio', onClick: () => setStudyBulk({ field: 'availability', action: 'add' }) },
            { label: 'Disponibilidad: quitar estudio',  onClick: () => setStudyBulk({ field: 'availability', action: 'remove' }) },
          ]}
        >
          <button
            onClick={() => setConfirm({ active: true, ids: sel.selectedIds })}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-[13px] text-white hover:bg-white/25 transition-colors font-body"
          >
            <CheckCircle2 size={14} /> Activar
          </button>
          <button
            onClick={() => setConfirm({ active: false, ids: sel.selectedIds })}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-[13px] text-white hover:bg-white/25 transition-colors font-body"
          >
            <XCircle size={14} /> Desactivar
          </button>
        </BulkActionBar>
      )}

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
          <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
            {canBulk && (
              <div className="flex items-center gap-3 px-3 sm:px-4 py-2.5 border-b border-[var(--outline-variant)] bg-surface-low/50">
                <input
                  type="checkbox"
                  checked={sel.allSelected}
                  ref={el => { if (el) el.indeterminate = sel.someSelected }}
                  onChange={sel.toggleAll}
                  aria-label="Seleccionar todos"
                  className="accent-coral h-4 w-4 shrink-0"
                />
                <span className="text-[11px] uppercase tracking-widest text-navy-light/60 font-display">
                  {sel.count > 0 ? `${sel.count} de ${filtered.length}` : `Seleccionar todos (${filtered.length})`}
                </span>
              </div>
            )}
            {visible.map(d => (
              <DirigenteRow
                key={d.member_id}
                d={d}
                selectable={canBulk}
                selected={sel.isSelected(d.member_id)}
                onToggleSelect={() => sel.toggle(d.member_id)}
                onOpen={() => router.push(`/estudios/dirigentes/${d.member_id}`)}
              />
            ))}
          </div>
          <LoadMoreFooter shown={shown} total={total} hasMore={hasMore} loading={false} onLoadMore={loadMore} noun="dirigentes" increment={25} />
        </>
      )}

      {showAdd && <AddDirigenteModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); refetch() }} />}

      {/* Confirmación de cambio de estado masivo */}
      {confirm && (
        <Modal onClose={() => setConfirm(null)} titleId="confirm-bulk-title" width={400}>
          <div className="p-6 space-y-4">
            <h3 id="confirm-bulk-title" className="text-base font-bold text-navy font-display">
              {confirm.active ? 'Activar dirigentes' : 'Desactivar dirigentes'}
            </h3>
            <p className="text-sm text-navy-light/70 font-body leading-relaxed">
              {confirm.ids.length} dirigente{confirm.ids.length === 1 ? '' : 's'} pasará{confirm.ids.length === 1 ? '' : 'n'} a{' '}
              <strong className="text-navy">{confirm.active ? 'activo' : 'inactivo'}</strong>.
              {confirm.active ? (
                <span className="block mt-1 text-[12px] text-navy-light/60">Se agregan al <strong>Comité de Dirigentes</strong> y se les asigna el <strong>rol de dirigente</strong>.</span>
              ) : (
                <span className="block mt-1 text-[12px] text-navy-light/60">Salen del <strong>Comité de Dirigentes</strong> y pierden el <strong>rol de dirigente</strong>. Los que tengan grupo en curso/abierto se omiten automáticamente.</span>
              )}
            </p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setConfirm(null)} disabled={applying} className="flex-1 rounded-full border border-[var(--outline-variant)] py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body">Cancelar</button>
              <button onClick={applyBulkStatus} disabled={applying} className="flex-1 rounded-full bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40 font-body">
                {applying ? 'Aplicando…' : `Sí, ${confirm.active ? 'activar' : 'desactivar'}`}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Bulk de formación / disponibilidad */}
      {studyBulk && (
        <BulkStudiesModal
          field={studyBulk.field}
          action={studyBulk.action}
          ids={sel.selectedIds}
          options={studyTypes}
          onClose={() => setStudyBulk(null)}
          onDone={() => { setStudyBulk(null); sel.clear(); refetch() }}
        />
      )}

      {/* Omitidos al desactivar (tenían grupo activo) */}
      <ActiveWarningModal
        open={!!skippedWarn}
        title="Algunos no se desactivaron"
        message={`${skippedWarn?.length ?? 0} dirigente(s) tienen un grupo en curso/abierto y se mantuvieron activos: ${(skippedWarn ?? []).map(id => nameById.get(id)).filter(Boolean).join(', ')}`}
        onClose={() => setSkippedWarn(null)}
      />
    </div>
  )
}

// ─── Filtro de estudio etiquetado ───────────────────────────────────────────────
function StudyFilter({
  label, hint, value, onChange, options,
}: {
  label: string; hint: string; value: string; onChange: (v: string) => void
  options: { code: string; name: string }[]
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-widest text-navy-light/60 font-display" title={hint}>{label}</p>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label={`${label} — ${hint}`}
        className={cn(
          'w-full rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-coral/30 font-body',
          value ? 'bg-coral/10 text-coral-deep' : 'bg-surface-low text-navy',
        )}
      >
        <option value="">Cualquiera</option>
        {options.map(t => <option key={t.code} value={t.code}>{t.code} — {t.name}</option>)}
      </select>
    </div>
  )
}

// ─── Modal: bulk de formación / disponibilidad ──────────────────────────────────
function BulkStudiesModal({
  field, action, ids, options, onClose, onDone,
}: {
  field: 'formation' | 'availability'; action: 'add' | 'remove'
  ids: string[]; options: { code: string; name: string }[]
  onClose: () => void; onDone: () => void
}) {
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)
  const fieldLabel = field === 'formation' ? 'la formación' : 'la disponibilidad'
  const verb = action === 'add' ? 'agregará a' : 'quitará de'
  const studyName = options.find(t => t.code === code)

  async function submit() {
    if (!code || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/studies/dirigentes/bulk-studies', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_ids: ids, field, code, action }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onDone()
    } catch (e) { console.error('No se pudo aplicar:', e) }
    finally { setSaving(false) }
  }

  return (
    <Modal onClose={onClose} titleId="bulk-studies-title" width={420}>
      <div className="p-6 space-y-4">
        <h3 id="bulk-studies-title" className="text-base font-bold text-navy font-display">
          {action === 'add' ? 'Agregar' : 'Quitar'} estudio a {field === 'formation' ? 'la formación' : 'la disponibilidad'}
        </h3>
        <div className="space-y-1">
          <label className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display">Estudio</label>
          <select
            value={code}
            onChange={e => setCode(e.target.value)}
            className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
          >
            <option value="">Seleccionar estudio…</option>
            {options.map(t => <option key={t.code} value={t.code}>{t.code} — {t.name}</option>)}
          </select>
        </div>
        {code && (
          <p className="text-[13px] text-navy-light/70 font-body rounded-xl bg-surface-low px-3 py-2.5">
            Se {verb} {fieldLabel} de <strong className="text-navy">{ids.length}</strong> dirigente{ids.length === 1 ? '' : 's'} el estudio{' '}
            <strong className="text-navy">{studyName ? `${studyName.code} — ${studyName.name}` : code}</strong>.
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 rounded-full border border-[var(--outline-variant)] py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body">Cancelar</button>
          <button onClick={submit} disabled={!code || saving} className="flex-1 rounded-full bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40 font-body">
            {saving ? 'Aplicando…' : 'Aplicar'}
          </button>
        </div>
      </div>
    </Modal>
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
