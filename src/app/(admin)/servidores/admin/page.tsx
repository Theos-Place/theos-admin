'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Edit2, X, AlertTriangle, ChevronRight, LayoutGrid, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOrg, type Area, type Committee } from '@/lib/org'
import { useServers } from '@/hooks/useServers'
import type { CommitteePosition } from '@/types/server'
import { DeleteConfirmModal } from '@/components/shared/DeleteConfirmModal'
import { ActiveWarningModal } from '@/components/shared/ActiveWarningModal'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'
const labelCls = 'text-[10px] tracking-widest uppercase text-navy-light/40 font-display'

// ─── Area modal ───────────────────────────────────────────────────────────────

function AreaModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Area
  onSave: (name: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const valid = name.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-ink/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative rounded-2xl p-6 w-full max-w-sm space-y-4 bg-surface-card shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-navy font-display">
            {initial ? 'Editar área' : 'Nueva área'}
          </h2>
          <button onClick={onClose} className="text-navy-light/40 hover:text-navy transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className={labelCls}>Nombre *</label>
          <input
            autoFocus
            className={inputCls}
            placeholder="Ej. Área Espiritual"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && valid) onSave(name.trim()) }}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            disabled={!valid}
            onClick={() => onSave(name.trim())}
            className="flex-1 rounded-full bg-coral px-4 py-2.5 text-sm text-white hover:bg-coral-deep transition-all disabled:opacity-40 font-body"
          >
            {initial ? 'Guardar cambios' : 'Crear área'}
          </button>
          <button
            onClick={onClose}
            className="rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Committee modal ──────────────────────────────────────────────────────────

function CommitteeModal({
  areas,
  initial,
  defaultAreaCode,
  onSave,
  onClose,
}: {
  areas: Area[]
  initial?: Committee
  defaultAreaCode?: string
  onSave: (name: string, area_code: string) => void
  onClose: () => void
}) {
  const [name, setName]         = useState(initial?.name ?? '')
  const [areaCode, setAreaCode] = useState(initial?.area_code ?? defaultAreaCode ?? areas[0]?.code ?? '')
  const valid = name.trim().length > 0 && areaCode.length > 0
  const activeAreas = areas.filter(a => a.is_active)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-ink/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative rounded-2xl p-6 w-full max-w-sm space-y-4 bg-surface-card shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-navy font-display">
            {initial ? 'Editar comité' : 'Nuevo comité'}
          </h2>
          <button onClick={onClose} className="text-navy-light/40 hover:text-navy transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className={labelCls}>Nombre *</label>
          <input
            autoFocus
            className={inputCls}
            placeholder="Ej. Comité de Anfitriones"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className={labelCls}>Área *</label>
          <select
            className={inputCls}
            value={areaCode}
            onChange={e => setAreaCode(e.target.value)}
          >
            {activeAreas.map(a => (
              <option key={a.code} value={a.code}>{a.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            disabled={!valid}
            onClick={() => onSave(name.trim(), areaCode)}
            className="flex-1 rounded-full bg-coral px-4 py-2.5 text-sm text-white hover:bg-coral-deep transition-all disabled:opacity-40 font-body"
          >
            {initial ? 'Guardar cambios' : 'Crear comité'}
          </button>
          <button
            onClick={onClose}
            className="rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Deactivate confirmation ──────────────────────────────────────────────────

function DeactivateConfirm({
  name,
  memberCount,
  onConfirm,
  onCancel,
}: {
  name: string
  memberCount: number
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-ink/60 backdrop-blur-sm" onClick={onCancel} />
      <div
        className="relative rounded-2xl p-6 w-full max-w-sm space-y-4 bg-surface-card shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-navy mb-1 font-display">
              ¿Desactivar &ldquo;{name}&rdquo;?
            </p>
            <p className="text-[13px] text-navy-light/60 leading-relaxed font-body">
              Este comité tiene <strong className="text-navy">{memberCount} miembro{memberCount !== 1 ? 's' : ''} activo{memberCount !== 1 ? 's' : ''}</strong>.
              Desactivarlo lo ocultará en formularios de postulación y perfil de servidores.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            className="flex-1 rounded-full bg-amber-500 px-4 py-2.5 text-sm text-white hover:bg-amber-600 transition-colors font-body"
          >
            Desactivar de igual manera
          </button>
          <button
            onClick={onCancel}
            className="rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Position modal (Cambio 3) ──────────────────────────────────────────────────

function PositionModal({
  onSave, onClose,
}: {
  onSave: (data: { title: string; description: string; maxVolunteers: number }) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [maxVol, setMaxVol] = useState('1')
  const valid = title.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-ink/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative rounded-2xl p-6 w-full max-w-sm space-y-4 bg-surface-card shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-navy font-display">Nuevo puesto</h2>
          <button onClick={onClose} className="text-navy-light/40 hover:text-navy transition-colors"><X size={18} /></button>
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Nombre *</label>
          <input autoFocus className={inputCls}
            placeholder="Ej. Colaborador de Bienvenida" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Descripción</label>
          <textarea className={cn(inputCls, 'resize-none')} rows={3}
            placeholder="Funciones del puesto..." value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Máximo de voluntarios</label>
          <input type="number" min={1} className={inputCls}
            value={maxVol} onChange={e => setMaxVol(e.target.value)} />
        </div>
        <div className="flex gap-2 pt-1">
          <button disabled={!valid}
            onClick={() => onSave({ title: title.trim(), description: description.trim(), maxVolunteers: Math.max(1, Number(maxVol) || 1) })}
            className="flex-1 rounded-full bg-coral px-4 py-2.5 text-sm text-white hover:bg-coral-deep transition-all disabled:opacity-40 font-body">
            Crear puesto
          </button>
          <button onClick={onClose} className="rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ServidoresAdminPage() {
  const { adminAreas, adminCommittees } = useOrg()
  const { committees: serverCommittees, refetch: refetchServers } = useServers()

  // Conteo real de servidores activos por comité (id de área-comité).
  const activeByCommittee = useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of serverCommittees) {
      m[c.id] = c.members.filter(mem => mem.status === 'active').length
    }
    return m
  }, [serverCommittees])
  // Puestos reales por comité (desde useServers).
  const positionsByCommittee = useMemo(() => {
    const m: Record<string, CommitteePosition[]> = {}
    for (const c of serverCommittees) m[c.id] = c.positions ?? []
    return m
  }, [serverCommittees])

  const [areas, setAreas]           = useState<Area[]>([])
  const [committees, setCommittees] = useState<Committee[]>([])
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null)
  const [selectedCommId, setSelectedCommId] = useState<string | null>(null)
  useEffect(() => { setAreas(adminAreas); setCommittees(adminCommittees) }, [adminAreas, adminCommittees])
  useEffect(() => {
    setSelectedAreaId((prev) => prev ?? adminAreas[0]?.id ?? null)
  }, [adminAreas])

  type AreaModal   = { open: boolean; editing: Area | null }
  type CommModal   = { open: boolean; editing: Committee | null }
  type DeactTarget = { type: 'area'; item: Area } | { type: 'committee'; item: Committee; memberCount: number } | null

  const [areaModal,   setAreaModal]   = useState<AreaModal>({ open: false, editing: null })
  const [commModal,   setCommModal]   = useState<CommModal>({ open: false, editing: null })
  const [deactTarget, setDeactTarget] = useState<DeactTarget>(null)
  const [posModalFor, setPosModalFor] = useState<string | null>(null)   // committee id
  // Eliminación: usa los modales compartidos. confirmState para borrar con palabra
  // "eliminar"; warn cuando hay servidores activos y se bloquea.
  const [confirmState, setConfirmState] = useState<{ title: string; description: string; run: () => Promise<void> } | null>(null)
  const [warn, setWarn] = useState<{ title: string; message: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const selectedArea   = areas.find(a => a.id === selectedAreaId)
  const areaComm       = committees.filter(c => c.area_code === selectedAreaId)
  const activeCount    = areas.filter(a => a.is_active).length
  const activeCommCount = committees.filter(c => c.is_active).length

  const selectedComm    = committees.find(c => c.id === selectedCommId) ?? null
  const selectedCommPositions = selectedCommId ? (positionsByCommittee[selectedCommId] ?? []) : []

  // Conteo real de miembros activos del comité.
  function getMemberCount(committee: Committee): number {
    return activeByCommittee[committee.id] ?? 0
  }

  // Personas activas de un área = suma de activos de sus comités.
  function getAreaActiveCount(areaId: string): number {
    return committees.filter(c => c.area_code === areaId).reduce((s, c) => s + (activeByCommittee[c.id] ?? 0), 0)
  }

  async function handleConfirmDelete() {
    if (!confirmState) return
    setDeleting(true)
    try { await confirmState.run() }
    finally { setDeleting(false); setConfirmState(null) }
  }

  // ── Eliminar área (Cambio 5): bloquea si hay servidores activos en sus comités ──
  function requestDeleteArea(area: Area) {
    const active = getAreaActiveCount(area.id)
    if (active > 0) {
      setWarn({ title: 'No se puede eliminar', message: `No podés eliminar esta área porque tiene ${active} servidor(es) activo(s) en sus comités. Primero reasigná o desactivá esos servidores.` })
      return
    }
    setConfirmState({
      title: 'Eliminar área',
      description: `Se eliminará el área "${area.name}" y todos sus comités y puestos. Esta acción no se puede deshacer.`,
      run: async () => {
        const res = await fetch(`/api/servers/areas/${area.id}`, { method: 'DELETE' })
        if (!res.ok) return
        setAreas(prev => prev.filter(a => a.id !== area.id))
        setCommittees(prev => prev.filter(c => c.area_code !== area.id))
        if (selectedAreaId === area.id) setSelectedAreaId(null)
        await refetchServers()
      },
    })
  }

  // ── Eliminar comité (Cambio 4): bloquea si hay servidores activos en sus puestos ──
  function requestDeleteCommittee(c: Committee) {
    const active = activeByCommittee[c.id] ?? 0
    if (active > 0) {
      setWarn({ title: 'No se puede eliminar', message: `No podés eliminar este comité porque tiene ${active} servidor(es) activo(s) en sus puestos. Primero reasigná o desactivá esos servidores.` })
      return
    }
    setConfirmState({
      title: 'Eliminar comité',
      description: `Se eliminará el comité "${c.name}" y sus puestos. Esta acción no se puede deshacer.`,
      run: async () => {
        const res = await fetch(`/api/servers/areas/${c.id}`, { method: 'DELETE' })
        if (!res.ok) return
        setCommittees(prev => prev.filter(x => x.id !== c.id))
        if (selectedCommId === c.id) setSelectedCommId(null)
        await refetchServers()
      },
    })
  }

  // ── Puestos (service_positions) ──────────────────────────────────────────────
  async function createPosition(data: { title: string; description: string; maxVolunteers: number }) {
    if (!posModalFor) return
    const areaId = posModalFor
    setPosModalFor(null)
    try {
      const res = await fetch('/api/servers/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area_id: areaId, title: data.title, description: data.description || null, max_volunteers: data.maxVolunteers }),
      })
      if (!res.ok) throw new Error()
      await refetchServers()
    } catch { /* sin cambios si falla */ }
  }

  // ── Eliminar puesto (Cambio 3): bloquea si hay servidores active/on_leave ──
  function requestDeletePosition(p: CommitteePosition) {
    const active = p.active_count ?? 0
    if (active > 0) {
      setWarn({ title: 'No se puede eliminar', message: `No podés eliminar este puesto porque tiene ${active} servidor(es) activo(s) asignado(s). Primero reasigná o desactivá esos servidores.` })
      return
    }
    setConfirmState({
      title: 'Eliminar puesto',
      description: `Se eliminará el puesto "${p.title}". Esta acción no se puede deshacer.`,
      run: async () => {
        const res = await fetch(`/api/servers/positions/${p.id}`, { method: 'DELETE' })
        if (!res.ok) return
        await refetchServers()
      },
    })
  }

  // ── Area handlers ──────────────────────────────────────────────────────────

  function saveArea(name: string) {
    const { editing } = areaModal
    if (editing) {
      const updated = areas.map(a => a.id === editing.id ? { ...a, name } : a)
      setAreas(updated)
    } else {
      const code = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 20)
      const id   = `${code}-${Date.now()}`
      const newArea: Area = { id, code, name, is_active: true }
      const updated = [...areas, newArea]
      setAreas(updated)
      setSelectedAreaId(id)
    }
    setAreaModal({ open: false, editing: null })
  }

  function requestToggleArea(area: Area) {
    if (area.is_active) {
      // Just deactivate — no member check needed for areas
      toggleAreaActive(area)
    } else {
      toggleAreaActive(area)
    }
  }

  function toggleAreaActive(area: Area) {
    const updated = areas.map(a => a.id === area.id ? { ...a, is_active: !a.is_active } : a)
    setAreas(updated)
  }

  // ── Committee handlers ────────────────────────────────────────────────────

  function saveCommittee(name: string, area_code: string) {
    const { editing } = commModal
    if (editing) {
      const updated = committees.map(c =>
        c.id === editing.id ? { ...c, name, area_code } : c
      )
      setCommittees(updated)
    } else {
      const newComm: Committee = {
        id: `${area_code}-${Date.now()}`,
        area_code,
        name,
        is_active: true,
      }
      const updated = [...committees, newComm]
      setCommittees(updated)
    }
    setCommModal({ open: false, editing: null })
  }

  function requestToggleCommittee(c: Committee) {
    if (c.is_active) {
      const memberCount = getMemberCount(c)
      if (memberCount > 0) {
        setDeactTarget({ type: 'committee', item: c, memberCount })
        return
      }
    }
    toggleCommitteeActive(c)
  }

  function toggleCommitteeActive(c: Committee) {
    const updated = committees.map(x => x.id === c.id ? { ...x, is_active: !x.is_active } : x)
    setCommittees(updated)
  }

  function confirmDeactivate() {
    if (!deactTarget) return
    if (deactTarget.type === 'committee') {
      toggleCommitteeActive(deactTarget.item)
    } else {
      toggleAreaActive(deactTarget.item)
    }
    setDeactTarget(null)
  }

  return (
    <div className="space-y-5">

      {/* Modals */}
      {areaModal.open && (
        <AreaModal
          initial={areaModal.editing ?? undefined}
          onSave={saveArea}
          onClose={() => setAreaModal({ open: false, editing: null })}
        />
      )}
      {commModal.open && (
        <CommitteeModal
          areas={areas}
          initial={commModal.editing ?? undefined}
          defaultAreaCode={selectedAreaId ?? undefined}
          onSave={saveCommittee}
          onClose={() => setCommModal({ open: false, editing: null })}
        />
      )}
      {deactTarget && deactTarget.type === 'committee' && (
        <DeactivateConfirm
          name={deactTarget.item.name}
          memberCount={deactTarget.memberCount}
          onConfirm={confirmDeactivate}
          onCancel={() => setDeactTarget(null)}
        />
      )}
      {posModalFor && (
        <PositionModal onSave={createPosition} onClose={() => setPosModalFor(null)} />
      )}
      <DeleteConfirmModal
        open={!!confirmState}
        title={confirmState?.title ?? ''}
        description={confirmState?.description ?? ''}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmState(null)}
      />
      <ActiveWarningModal
        open={!!warn}
        title={warn?.title ?? ''}
        message={warn?.message ?? ''}
        onClose={() => setWarn(null)}
      />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1
            className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]"
          >
            Áreas y comités
          </h1>
          <p className="mt-1 text-sm text-navy-light/60 font-body">
            {activeCount} área{activeCount !== 1 ? 's' : ''} activa{activeCount !== 1 ? 's' : ''} · {activeCommCount} comités activos
          </p>
        </div>
      </div>

      {/* Paneles: áreas · comités · (puestos cuando hay comité seleccionado) */}
      <div className={cn('grid gap-4', selectedComm ? 'lg:grid-cols-[260px_1fr_320px]' : 'lg:grid-cols-[300px_1fr]')}>

        {/* ── Left: areas ─────────────────────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden flex flex-col bg-surface-card shadow-[var(--shadow-md)] min-h-[480px]"
        >
          <div
            className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--outline-variant)]"
          >
            <span className="text-[11px] font-bold uppercase tracking-widest text-navy-light/50 font-display">
              Áreas ({areas.length})
            </span>
            <button
              onClick={() => setAreaModal({ open: true, editing: null })}
              className="inline-flex items-center gap-1 rounded-full bg-coral/10 hover:bg-coral/20 text-coral px-3 py-1.5 text-[12px] font-medium transition-colors font-body"
            >
              <Plus size={12} />
              Nueva
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {areas.map((area, i) => {
              const isSelected = selectedAreaId === area.id
              return (
                <button
                  key={area.id}
                  onClick={() => setSelectedAreaId(area.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors group',
                    isSelected ? 'bg-navy text-white' : 'hover:bg-surface-low',
                    i < areas.length - 1 && 'border-b border-[var(--outline-variant)]',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn('text-[13px] font-medium truncate font-body', isSelected ? 'text-white' : 'text-navy')}
                    >
                      {area.name}
                    </p>
                    <p className={cn('text-[11px] mt-0.5 font-body', isSelected ? 'text-white/50' : 'text-navy-light/40')}>
                      {committees.filter(c => c.area_code === area.id && c.is_active).length} comité{committees.filter(c => c.area_code === area.id && c.is_active).length !== 1 ? 's' : ''} activo{committees.filter(c => c.area_code === area.id && c.is_active).length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    {/* Toggle */}
                    <label
                      className="toggle cursor-pointer"
                      title={area.is_active ? 'Desactivar área' : 'Activar área'}
                    >
                      <input
                        type="checkbox"
                        checked={area.is_active}
                        onChange={() => requestToggleArea(area)}
                      />
                      <div className="toggle-track" />
                    </label>
                    {/* Edit */}
                    <button
                      onClick={() => setAreaModal({ open: true, editing: area })}
                      className={cn(
                        'rounded-lg p-1.5 transition-colors',
                        isSelected ? 'text-white/60 hover:text-white hover:bg-white/10' : 'text-navy-light/40 hover:text-navy hover:bg-surface-low'
                      )}
                      title="Editar área"
                    >
                      <Edit2 size={12} />
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => requestDeleteArea(area)}
                      className={cn(
                        'rounded-lg p-1.5 transition-colors',
                        isSelected ? 'text-white/60 hover:text-white hover:bg-white/10' : 'text-navy-light/40 hover:text-coral hover:bg-coral/10'
                      )}
                      title="Eliminar área"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {isSelected && <ChevronRight size={13} className="text-white/40 shrink-0 -mr-1" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Right: committees ────────────────────────────────────── */}
        {selectedArea ? (
          <div
            className="rounded-2xl overflow-hidden flex flex-col bg-surface-card shadow-[var(--shadow-md)] min-h-[480px]"
          >
            <div
              className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--outline-variant)]"
            >
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-navy-light/50 font-display">
                  Comités
                </span>
                <p className="text-base font-bold text-navy mt-0.5 font-display">
                  {selectedArea.name}
                </p>
              </div>
              <button
                onClick={() => setCommModal({ open: true, editing: null })}
                className="inline-flex items-center gap-1 rounded-full bg-coral/10 hover:bg-coral/20 text-coral px-3 py-1.5 text-[12px] font-medium transition-colors font-body"
              >
                <Plus size={12} />
                Nuevo
              </button>
            </div>

            {areaComm.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-12 text-center">
                <LayoutGrid size={28} className="text-navy-light/20" />
                <p className="text-sm text-navy-light/40 font-body">
                  No hay comités en esta área
                </p>
                <button
                  onClick={() => setCommModal({ open: true, editing: null })}
                  className="text-[12px] text-coral hover:underline font-body"
                >
                  Crear el primero
                </button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[var(--outline-variant)]">
                        {['Comité', 'Miembros activos', 'Estado', ''].map(h => (
                          <th
                            key={h}
                            className="px-5 py-3 text-left text-[10px] tracking-widest uppercase text-navy-light/40 whitespace-nowrap font-display"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {areaComm.map((c, i) => {
                        const memberCount = getMemberCount(c)
                        return (
                          <tr
                            key={c.id}
                            onClick={() => setSelectedCommId(prev => prev === c.id ? null : c.id)}
                            className={cn('group transition-colors cursor-pointer', !c.is_active && 'opacity-50',
                              selectedCommId === c.id ? 'bg-coral/5' : 'hover:bg-surface-low',
                              i < areaComm.length - 1 && 'border-b border-[var(--outline-variant)]')}
                          >
                            <td className="px-5 py-3">
                              <span className={cn('text-[13px] font-medium font-body', selectedCommId === c.id ? 'text-coral' : 'text-navy')}>
                                {c.name}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <span
                                className={cn(
                                  'text-[12px] font-body',
                                  memberCount > 0 ? 'text-navy-light/70' : 'text-navy-light/30 italic'
                                )}
                              >
                                {memberCount > 0 ? `${memberCount} miembro${memberCount !== 1 ? 's' : ''}` : '—'}
                              </span>
                            </td>
                            <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                              <label
                                className="toggle cursor-pointer"
                                title={c.is_active ? 'Desactivar comité' : 'Activar comité'}
                              >
                                <input
                                  type="checkbox"
                                  checked={c.is_active}
                                  onChange={() => requestToggleCommittee(c)}
                                />
                                <div className="toggle-track" />
                              </label>
                            </td>
                            <td className="px-5 py-3 text-right" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => setCommModal({ open: true, editing: c })}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] px-3 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors font-body"
                                >
                                  <Edit2 size={11} />
                                  Editar
                                </button>
                                <button
                                  onClick={() => requestDeleteCommittee(c)}
                                  className="inline-flex items-center justify-center rounded-full border border-[var(--outline-variant)] h-7 w-7 text-navy-light/50 hover:text-coral hover:border-coral/30 transition-colors"
                                  title="Eliminar comité"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            className="rounded-2xl flex flex-col items-center justify-center gap-3 p-12 text-center bg-surface-card shadow-[var(--shadow-md)] min-h-[480px]"
          >
            <LayoutGrid size={32} className="text-navy-light/15" />
            <p className="text-sm text-navy-light/40 font-body">
              Seleccioná un área para ver sus comités
            </p>
          </div>
        )}

        {/* ── Third panel: puestos del comité seleccionado (Cambio 3) ── */}
        {selectedComm && (
          <div
            className="rounded-2xl overflow-hidden flex flex-col bg-surface-card shadow-[var(--shadow-md)] min-h-[480px]"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--outline-variant)]">
              <div className="min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-widest text-navy-light/50 font-display">
                  Puestos
                </span>
                <p className="text-base font-bold text-navy mt-0.5 truncate font-display">
                  {selectedComm.name}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setPosModalFor(selectedComm.id)}
                  className="inline-flex items-center gap-1 rounded-full bg-coral/10 hover:bg-coral/20 text-coral px-3 py-1.5 text-[12px] font-medium transition-colors font-body"
                >
                  <Plus size={12} />
                  Nuevo
                </button>
                <button onClick={() => setSelectedCommId(null)} className="text-navy-light/40 hover:text-navy p-1" title="Cerrar">
                  <X size={16} />
                </button>
              </div>
            </div>

            {selectedCommPositions.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-10 text-center">
                <LayoutGrid size={26} className="text-navy-light/20" />
                <p className="text-sm text-navy-light/40 font-body">
                  Este comité no tiene puestos
                </p>
                <button onClick={() => setPosModalFor(selectedComm.id)} className="text-[12px] text-coral hover:underline font-body">
                  Crear el primero
                </button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto py-1.5">
                {selectedCommPositions.map((p, i) => (
                  <div
                    key={p.id}
                    className={cn('group flex items-center gap-2 px-5 py-2.5 hover:bg-surface-low transition-colors',
                      i < selectedCommPositions.length - 1 && 'border-b border-[var(--outline-variant)]')}
                  >
                    <span className="flex-1 text-[13px] text-navy font-body">{p.title}</span>
                    <button
                      onClick={() => requestDeletePosition(p)}
                      className="rounded-lg p-1.5 text-navy-light/40 hover:text-coral hover:bg-coral/10 transition-colors opacity-0 group-hover:opacity-100"
                      title="Eliminar puesto"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
