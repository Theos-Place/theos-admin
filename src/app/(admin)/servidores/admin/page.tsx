'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit2, X, AlertTriangle, ChevronRight, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOrg, type Area, type Committee } from '@/lib/org'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'
const labelCls = 'text-[10px] tracking-widest uppercase text-navy-light/40'

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
        className="relative rounded-2xl p-6 w-full max-w-sm space-y-4"
        style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-lg)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
            {initial ? 'Editar área' : 'Nueva área'}
          </h2>
          <button onClick={onClose} className="text-navy-light/40 hover:text-navy transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className={labelCls} style={{ fontFamily: 'var(--font-display)' }}>Nombre *</label>
          <input
            autoFocus
            className={inputCls}
            style={{ fontFamily: 'var(--font-body)' }}
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
            className="flex-1 rounded-full bg-coral px-4 py-2.5 text-sm text-white hover:bg-coral-deep transition-all disabled:opacity-40"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {initial ? 'Guardar cambios' : 'Crear área'}
          </button>
          <button
            onClick={onClose}
            className="rounded-full border px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
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
        className="relative rounded-2xl p-6 w-full max-w-sm space-y-4"
        style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-lg)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
            {initial ? 'Editar comité' : 'Nuevo comité'}
          </h2>
          <button onClick={onClose} className="text-navy-light/40 hover:text-navy transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className={labelCls} style={{ fontFamily: 'var(--font-display)' }}>Nombre *</label>
          <input
            autoFocus
            className={inputCls}
            style={{ fontFamily: 'var(--font-body)' }}
            placeholder="Ej. Comité de Anfitriones"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className={labelCls} style={{ fontFamily: 'var(--font-display)' }}>Área *</label>
          <select
            className={inputCls}
            style={{ fontFamily: 'var(--font-body)' }}
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
            className="flex-1 rounded-full bg-coral px-4 py-2.5 text-sm text-white hover:bg-coral-deep transition-all disabled:opacity-40"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {initial ? 'Guardar cambios' : 'Crear comité'}
          </button>
          <button
            onClick={onClose}
            className="rounded-full border px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
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
        className="relative rounded-2xl p-6 w-full max-w-sm space-y-4"
        style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-lg)' }}
      >
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-navy mb-1" style={{ fontFamily: 'var(--font-display)' }}>
              ¿Desactivar &ldquo;{name}&rdquo;?
            </p>
            <p className="text-[13px] text-navy-light/60 leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>
              Este comité tiene <strong className="text-navy">{memberCount} miembro{memberCount !== 1 ? 's' : ''} activo{memberCount !== 1 ? 's' : ''}</strong>.
              Desactivarlo lo ocultará en formularios de postulación y perfil de servidores.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            className="flex-1 rounded-full bg-amber-500 px-4 py-2.5 text-sm text-white hover:bg-amber-600 transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Desactivar de igual manera
          </button>
          <button
            onClick={onCancel}
            className="rounded-full border px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
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
  const [areas, setAreas]           = useState<Area[]>([])
  const [committees, setCommittees] = useState<Committee[]>([])
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null)
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

  const selectedArea   = areas.find(a => a.id === selectedAreaId)
  const areaComm       = committees.filter(c => c.area_code === selectedAreaId)
  const activeCount    = areas.filter(a => a.is_active).length
  const activeCommCount = committees.filter(c => c.is_active).length

  // Simulated member count per committee (mock — committees from mock-servers have partial data)
  function getMemberCount(committee: Committee): number {
    // Deterministic mock count based on committee id to keep UI interesting
    const seed = committee.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
    return seed % 22
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

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1
            className="text-2xl text-navy"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            Áreas y comités
          </h1>
          <p className="mt-1 text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
            {activeCount} área{activeCount !== 1 ? 's' : ''} activa{activeCount !== 1 ? 's' : ''} · {activeCommCount} comités activos
          </p>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="grid lg:grid-cols-[300px_1fr] gap-4">

        {/* ── Left: areas ─────────────────────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden flex flex-col"
          style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)', minHeight: 480 }}
        >
          <div
            className="flex items-center justify-between px-4 py-3.5"
            style={{ borderBottom: '1px solid var(--outline-variant)' }}
          >
            <span className="text-[11px] font-bold uppercase tracking-widest text-navy-light/50" style={{ fontFamily: 'var(--font-display)' }}>
              Áreas ({areas.length})
            </span>
            <button
              onClick={() => setAreaModal({ open: true, editing: null })}
              className="inline-flex items-center gap-1 rounded-full bg-coral/10 hover:bg-coral/20 text-coral px-3 py-1.5 text-[12px] font-medium transition-colors"
              style={{ fontFamily: 'var(--font-body)' }}
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
                  )}
                  style={i < areas.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn('text-[13px] font-medium truncate', isSelected ? 'text-white' : 'text-navy')}
                      style={{ fontFamily: 'var(--font-body)' }}
                    >
                      {area.name}
                    </p>
                    <p className={cn('text-[11px] mt-0.5', isSelected ? 'text-white/50' : 'text-navy-light/40')} style={{ fontFamily: 'var(--font-body)' }}>
                      {committees.filter(c => c.area_code === area.id && c.is_active).length} comité{committees.filter(c => c.area_code === area.id && c.is_active).length !== 1 ? 's' : ''} activo{committees.filter(c => c.area_code === area.id && c.is_active).length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    {/* Toggle */}
                    <label
                      className="toggle"
                      title={area.is_active ? 'Desactivar área' : 'Activar área'}
                      style={{ cursor: 'pointer' }}
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
            className="rounded-2xl overflow-hidden flex flex-col"
            style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)', minHeight: 480 }}
          >
            <div
              className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: '1px solid var(--outline-variant)' }}
            >
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-navy-light/50" style={{ fontFamily: 'var(--font-display)' }}>
                  Comités
                </span>
                <p className="text-base font-bold text-navy mt-0.5" style={{ fontFamily: 'var(--font-display)' }}>
                  {selectedArea.name}
                </p>
              </div>
              <button
                onClick={() => setCommModal({ open: true, editing: null })}
                className="inline-flex items-center gap-1 rounded-full bg-coral/10 hover:bg-coral/20 text-coral px-3 py-1.5 text-[12px] font-medium transition-colors"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <Plus size={12} />
                Nuevo
              </button>
            </div>

            {areaComm.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-12 text-center">
                <LayoutGrid size={28} className="text-navy-light/20" />
                <p className="text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
                  No hay comités en esta área
                </p>
                <button
                  onClick={() => setCommModal({ open: true, editing: null })}
                  className="text-[12px] text-coral hover:underline"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  Crear el primero
                </button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--outline-variant)' }}>
                        {['Comité', 'Miembros activos', 'Estado', ''].map(h => (
                          <th
                            key={h}
                            className="px-5 py-3 text-left text-[10px] tracking-widest uppercase text-navy-light/40 whitespace-nowrap"
                            style={{ fontFamily: 'var(--font-display)' }}
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
                            className={cn('group transition-colors hover:bg-surface-low', !c.is_active && 'opacity-50')}
                            style={i < areaComm.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
                          >
                            <td className="px-5 py-3">
                              <span className="text-[13px] text-navy font-medium" style={{ fontFamily: 'var(--font-body)' }}>
                                {c.name}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <span
                                className={cn(
                                  'text-[12px]',
                                  memberCount > 0 ? 'text-navy-light/70' : 'text-navy-light/30 italic'
                                )}
                                style={{ fontFamily: 'var(--font-body)' }}
                              >
                                {memberCount > 0 ? `${memberCount} miembro${memberCount !== 1 ? 's' : ''}` : '—'}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <label
                                className="toggle"
                                title={c.is_active ? 'Desactivar comité' : 'Activar comité'}
                                style={{ cursor: 'pointer' }}
                              >
                                <input
                                  type="checkbox"
                                  checked={c.is_active}
                                  onChange={() => requestToggleCommittee(c)}
                                />
                                <div className="toggle-track" />
                              </label>
                            </td>
                            <td className="px-5 py-3 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setCommModal({ open: true, editing: c })}
                                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
                                style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                              >
                                <Edit2 size={11} />
                                Editar
                              </button>
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
            className="rounded-2xl flex flex-col items-center justify-center gap-3 p-12 text-center"
            style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)', minHeight: 480 }}
          >
            <LayoutGrid size={32} className="text-navy-light/15" />
            <p className="text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
              Seleccioná un área para ver sus comités
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
