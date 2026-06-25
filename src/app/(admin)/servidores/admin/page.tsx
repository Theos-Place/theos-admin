'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Edit2, X, AlertTriangle, ChevronRight, ChevronDown, LayoutGrid, Trash2, Upload } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/lib/utils'
import { useOrg, type Area, type Committee } from '@/lib/org'
import { useServers } from '@/hooks/useServers'
import { useAuth } from '@/hooks/useAuth'
import { SERVICE_ADMIN_ROLES, STAFF_IMPORT_ROLES } from '@/lib/auth/roles'
import { AccessDenied } from '@/components/shared/AccessDenied'
import type { CommitteePosition } from '@/types/server'
import { Modal } from '@/components/shared/Modal'
import { useToast } from '@/components/shared/Toast'
import { PositionRequestsSection } from './_PositionRequests'
import { DeleteConfirmModal } from '@/components/shared/DeleteConfirmModal'
import { ActiveWarningModal } from '@/components/shared/ActiveWarningModal'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'
const labelCls = 'text-[10px] tracking-widest uppercase text-navy-light/60 font-display'

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
    <Modal onClose={onClose} titleId="area-modal-title" width={384}>
      <div className="p-6 space-y-4">
        <h2 id="area-modal-title" className="text-base font-bold text-navy font-display">
          {initial ? 'Editar área' : 'Nueva área'}
        </h2>

        <div className="space-y-1.5">
          <label className={labelCls}>Nombre *</label>
          <input
            autoFocus
            aria-label="Nombre del área"
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
    </Modal>
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
    <Modal onClose={onClose} titleId="committee-modal-title" width={384}>
      <div className="p-6 space-y-4">
        <h2 id="committee-modal-title" className="text-base font-bold text-navy font-display">
          {initial ? 'Editar comité' : 'Nuevo comité'}
        </h2>

        <div className="space-y-1.5">
          <label className={labelCls}>Nombre *</label>
          <input
            autoFocus
            aria-label="Nombre del comité"
            className={inputCls}
            placeholder="Ej. Comité de Anfitriones"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className={labelCls}>Área *</label>
          <select
            aria-label="Área del comité"
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
    </Modal>
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
    <Modal onClose={onCancel} titleId="deactivate-confirm-title" width={384}>
      <div className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-amber-500" />
          </div>
          <div>
            <p id="deactivate-confirm-title" className="text-sm font-bold text-navy mb-1 font-display">
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
    </Modal>
  )
}

// ─── Position modal (Cambio 3) ──────────────────────────────────────────────────

export type PositionFormData = {
  title: string
  description: string
  location: string
  quantity: number
  study_requirement: string
  functions: string
  profile: string
  expires_at: string
  is_featured: boolean
  base_area_id: string
}

function PositionModal({
  areas, onSave, onClose,
}: {
  areas: { id: string; name: string }[]
  onSave: (data: PositionFormData) => void
  onClose: () => void
}) {
  const [f, setF] = useState<PositionFormData>({
    title: '', description: '', location: '', quantity: 1, study_requirement: '',
    functions: '', profile: '', expires_at: '', is_featured: false, base_area_id: '',
  })
  const set = <K extends keyof PositionFormData>(k: K, v: PositionFormData[K]) => setF(p => ({ ...p, [k]: v }))
  const valid = f.title.trim().length > 0

  return (
    <Modal onClose={onClose} titleId="position-modal-title" width={448}>
      <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
        <h2 id="position-modal-title" className="text-base font-bold text-navy font-display">Nuevo puesto</h2>
        <div className="space-y-1.5">
          <label className={labelCls}>Nombre del puesto *</label>
          <input autoFocus aria-label="Nombre del puesto" className={inputCls}
            placeholder="Ej. Colaborador de Bienvenida" value={f.title} onChange={e => set('title', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className={labelCls}>Ubicación</label>
            <input aria-label="Ubicación" className={inputCls} placeholder="Sede / lugar" value={f.location} onChange={e => set('location', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Cantidad</label>
            <input type="number" min={1} aria-label="Cantidad" className={inputCls} value={f.quantity} onChange={e => set('quantity', Math.max(1, Number(e.target.value) || 1))} />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Área base</label>
          <select className={inputCls} value={f.base_area_id} onChange={e => set('base_area_id', e.target.value)}>
            <option value="">Sin área base</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Requisito de estudio (categoría)</label>
          <input aria-label="Requisito de estudio" className={inputCls} placeholder="Ej. N4 completado" value={f.study_requirement} onChange={e => set('study_requirement', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Descripción</label>
          <textarea aria-label="Descripción del puesto" className={cn(inputCls, 'resize-none')} rows={2} value={f.description} onChange={e => set('description', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Funciones</label>
          <textarea aria-label="Funciones" className={cn(inputCls, 'resize-none')} rows={2} value={f.functions} onChange={e => set('functions', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Perfil</label>
          <textarea aria-label="Perfil" className={cn(inputCls, 'resize-none')} rows={2} value={f.profile} onChange={e => set('profile', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3 items-end">
          <div className="space-y-1.5">
            <label className={labelCls}>Expiración</label>
            <input type="date" aria-label="Expiración" className={inputCls} value={f.expires_at} onChange={e => set('expires_at', e.target.value)} />
          </div>
          <label className="flex items-center gap-2 pb-2 cursor-pointer">
            <input type="checkbox" className="accent-coral" checked={f.is_featured} onChange={e => set('is_featured', e.target.checked)} />
            <span className="text-sm text-navy font-body">Destacado</span>
          </label>
        </div>
        <div className="flex gap-2 pt-1">
          <button disabled={!valid}
            onClick={() => onSave({ ...f, title: f.title.trim() })}
            className="flex-1 rounded-full bg-coral px-4 py-2.5 text-sm text-white hover:bg-coral-deep transition-all disabled:opacity-40 font-body">
            Crear puesto
          </button>
          <button onClick={onClose} className="rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body">
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** Edición enfocada de los campos descriptivos de un puesto (título, nivel de
 *  estudio, descripción, funciones, perfil). Solo envía estos campos (PUT parcial)
 *  para no tocar ubicación/cantidad/expiración/destacado. */
type PosDescFields = { title: string; study_requirement: string; description: string; functions: string; profile: string }
function PositionEditModal({
  initial, onSave, onClose,
}: {
  initial: { title: string; study_requirement?: string | null; description?: string | null; functions?: string | null; profile?: string | null }
  onSave: (data: PosDescFields) => void
  onClose: () => void
}) {
  const [f, setF] = useState<PosDescFields>({
    title: initial.title ?? '',
    study_requirement: initial.study_requirement ?? '',
    description: initial.description ?? '',
    functions: initial.functions ?? '',
    profile: initial.profile ?? '',
  })
  const set = <K extends keyof PosDescFields>(k: K, v: PosDescFields[K]) => setF(p => ({ ...p, [k]: v }))
  const valid = f.title.trim().length > 0
  return (
    <Modal onClose={onClose} titleId="pos-edit-title" width={520}>
      <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
        <h2 id="pos-edit-title" className="text-base font-bold text-navy font-display">Editar puesto</h2>
        <div className="space-y-1.5">
          <label className={labelCls}>Nombre del puesto *</label>
          <input autoFocus aria-label="Nombre del puesto" className={inputCls} value={f.title} onChange={e => set('title', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Nivel de estudio</label>
          <input aria-label="Nivel de estudio" className={inputCls} placeholder="Ej. Discípulos 2" value={f.study_requirement} onChange={e => set('study_requirement', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Descripción</label>
          <textarea aria-label="Descripción" className={cn(inputCls, 'resize-y')} rows={2} value={f.description} onChange={e => set('description', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Funciones (una por línea, con •)</label>
          <textarea aria-label="Funciones" className={cn(inputCls, 'resize-y font-mono text-[12px]')} rows={8} value={f.functions} onChange={e => set('functions', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Perfil (una por línea, con •)</label>
          <textarea aria-label="Perfil" className={cn(inputCls, 'resize-y font-mono text-[12px]')} rows={8} value={f.profile} onChange={e => set('profile', e.target.value)} />
        </div>
        <div className="flex gap-2 pt-1">
          <button disabled={!valid}
            onClick={() => onSave({ ...f, title: f.title.trim() })}
            className="flex-1 rounded-full bg-coral px-4 py-2.5 text-sm text-white hover:bg-coral-deep transition-all disabled:opacity-40 font-body">
            Guardar cambios
          </button>
          <button onClick={onClose} className="rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body">
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ServidoresAdminPage() {
  const { hasRole, loaded } = useAuth()
  const { adminAreas, adminCommittees, refetch: refetchOrg } = useOrg()
  const { committees: serverCommittees, refetch: refetchServers } = useServers()
  const toast = useToast()

  // Áreas reales (tipo area) para el dropdown de "área base" del puesto.
  const [baseAreas, setBaseAreas] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    let alive = true
    fetch('/api/servers/areas')
      .then(r => (r.ok ? r.json() : []))
      .then((d: Array<{ id: string; name: string }>) => { if (alive) setBaseAreas((Array.isArray(d) ? d : []).map(a => ({ id: a.id, name: a.name }))) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

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
  const [expandedPos, setExpandedPos] = useState<Set<string>>(new Set()) // puestos con detalle abierto
  const [editPos, setEditPos] = useState<CommitteePosition | null>(null) // edición de campos descriptivos
  function togglePos(id: string) {
    setExpandedPos(prev => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s })
  }
  async function savePositionDesc(data: { title: string; study_requirement: string; description: string; functions: string; profile: string }) {
    const target = editPos
    setEditPos(null)
    if (!target) return
    try {
      const res = await fetch(`/api/servers/positions/${target.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          study_requirement: data.study_requirement || null,
          description: data.description || null,
          functions: data.functions || null,
          profile: data.profile || null,
        }),
      })
      if (!res.ok) throw new Error()
      await refetchServers()
      toast('Puesto actualizado', 'success')
    } catch {
      toast('No se pudo guardar el puesto.', 'error')
    }
  }
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
        if (selectedAreaId === area.id) setSelectedAreaId(null)
        refetchOrg()
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
        if (selectedCommId === c.id) setSelectedCommId(null)
        refetchOrg()
        await refetchServers()
      },
    })
  }

  // ── Puestos (service_positions) ──────────────────────────────────────────────
  async function createPosition(data: PositionFormData) {
    if (!posModalFor) return
    const areaId = posModalFor
    setPosModalFor(null)
    try {
      const res = await fetch('/api/servers/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area_id: areaId,
          title: data.title,
          description: data.description || null,
          location: data.location || null,
          quantity: data.quantity,
          study_requirement: data.study_requirement || null,
          functions: data.functions || null,
          profile: data.profile || null,
          expires_at: data.expires_at || null,
          is_featured: data.is_featured,
          base_area_id: data.base_area_id || null,
        }),
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

  async function saveArea(name: string) {
    const { editing } = areaModal
    setAreaModal({ open: false, editing: null })
    try {
      if (editing) {
        const res = await fetch(`/api/servers/areas/${editing.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
        })
        if (!res.ok) throw new Error()
      } else {
        const res = await fetch('/api/servers/areas', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, area_type: 'area' }),
        })
        if (!res.ok) throw new Error()
        const { id } = await res.json()
        if (id) setSelectedAreaId(id)
      }
      refetchOrg()
    } catch { /* sin cambios si falla */ }
  }

  function requestToggleArea(area: Area) {
    toggleAreaActive(area)
  }

  async function toggleAreaActive(area: Area) {
    try {
      const res = await fetch(`/api/servers/areas/${area.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !area.is_active }),
      })
      if (res.ok) refetchOrg()
    } catch { /* */ }
  }

  // ── Committee handlers ────────────────────────────────────────────────────

  async function saveCommittee(name: string, area_code: string) {
    const { editing } = commModal
    setCommModal({ open: false, editing: null })
    try {
      if (editing) {
        const res = await fetch(`/api/servers/areas/${editing.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, parent_id: area_code || null }),
        })
        if (!res.ok) throw new Error()
      } else {
        const res = await fetch('/api/servers/areas', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, area_type: 'committee', parent_id: area_code || null }),
        })
        if (!res.ok) throw new Error()
      }
      refetchOrg()
    } catch { /* sin cambios si falla */ }
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

  async function toggleCommitteeActive(c: Committee) {
    try {
      const res = await fetch(`/api/servers/areas/${c.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !c.is_active }),
      })
      if (res.ok) { refetchOrg(); await refetchServers() }
    } catch { /* */ }
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

  // Mantenimiento solo para encargado_staff / coordinador_servidores / admin.
  if (loaded && !hasRole(...SERVICE_ADMIN_ROLES)) return <AccessDenied />

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
        <PositionModal areas={baseAreas} onSave={createPosition} onClose={() => setPosModalFor(null)} />
      )}

      {editPos && (
        <PositionEditModal initial={editPos} onSave={savePositionDesc} onClose={() => setEditPos(null)} />
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
        {/* Importar: solo admin + coordinación de staff (puntos 4 y 6). */}
        {hasRole('admin', ...STAFF_IMPORT_ROLES) && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <a
              href="/servidores/admin/importar"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
            >
              <Upload size={14} /> Importar puestos
            </a>
            <a
              href="/servidores/admin/importar-vacantes"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
            >
              <Upload size={14} /> Importar vacantes
            </a>
          </div>
        )}
      </div>

      {/* Solicitudes de puesto nuevo pendientes (Flujo 2) — Staff/admin las aprueba. */}
      <PositionRequestsSection />

      {/* Paneles: áreas · comités · (puestos cuando hay comité seleccionado) */}
      <div className={cn('grid gap-4', selectedComm ? 'lg:grid-cols-[240px_minmax(0,1fr)_minmax(0,1fr)]' : 'lg:grid-cols-[300px_1fr]')}>

        {/* ── Left: areas ─────────────────────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden flex flex-col bg-surface-card shadow-[var(--shadow-md)] min-h-[480px]"
        >
          <div
            className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--outline-variant)]"
          >
            <span className="text-[11px] font-bold uppercase tracking-widest text-navy-light/60 font-display">
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
                // Fila = div con un botón interno para seleccionar: un <button>
                // no puede contener los botones de acciones (HTML inválido,
                // error de hidratación).
                <div
                  key={area.id}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors group',
                    isSelected ? 'bg-navy text-white' : 'hover:bg-surface-low',
                    i < areas.length - 1 && 'border-b border-[var(--outline-variant)]',
                  )}
                >
                  <button
                    onClick={() => setSelectedAreaId(area.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p
                      className={cn('text-[13px] font-medium truncate font-body', isSelected ? 'text-white' : 'text-navy')}
                    >
                      {area.name}
                    </p>
                    <p className={cn('text-[11px] mt-0.5 font-body', isSelected ? 'text-white/60' : 'text-navy-light/60')}>
                      {committees.filter(c => c.area_code === area.id && c.is_active).length} comité{committees.filter(c => c.area_code === area.id && c.is_active).length !== 1 ? 's' : ''} activo{committees.filter(c => c.area_code === area.id && c.is_active).length !== 1 ? 's' : ''}
                    </p>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Toggle */}
                    <label
                      className="toggle cursor-pointer"
                      title={area.is_active ? 'Desactivar área' : 'Activar área'}
                    >
                      <input
                        type="checkbox"
                        aria-label={area.is_active ? `Desactivar área ${area.name}` : `Activar área ${area.name}`}
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
                        isSelected ? 'text-white/60 hover:text-white hover:bg-white/10' : 'text-navy-light/60 hover:text-navy hover:bg-surface-low'
                      )}
                      title="Editar área"
                      aria-label={`Editar área ${area.name}`}
                    >
                      <Edit2 size={12} />
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => requestDeleteArea(area)}
                      className={cn(
                        'rounded-lg p-1.5 transition-colors',
                        isSelected ? 'text-white/60 hover:text-white hover:bg-white/10' : 'text-navy-light/60 hover:text-coral hover:bg-coral/10'
                      )}
                      title="Eliminar área"
                      aria-label={`Eliminar área ${area.name}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {isSelected && <ChevronRight size={13} className="text-white/70 shrink-0 -mr-1" />}
                </div>
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
                <span className="text-[11px] font-bold uppercase tracking-widest text-navy-light/60 font-display">
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
              <EmptyState
                className="flex-1"
                icon={LayoutGrid}
                title="No hay comités en esta área"
                action={
                  <button
                    onClick={() => setCommModal({ open: true, editing: null })}
                    className="text-[12px] text-coral hover:underline font-body"
                  >
                    Crear el primero
                  </button>
                }
              />
            ) : (
              <div className="flex-1 overflow-y-auto">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[var(--outline-variant)]">
                        {['Comité', 'Miembros activos', 'Estado', ''].map(h => (
                          <th
                            key={h}
                            className="px-5 py-3 text-left text-[10px] tracking-widest uppercase text-navy-light/60 whitespace-nowrap font-display"
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
                                  memberCount > 0 ? 'text-navy-light/70' : 'text-navy-light/60 italic'
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
                                  aria-label={c.is_active ? `Desactivar comité ${c.name}` : `Activar comité ${c.name}`}
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
                                  className="inline-flex items-center justify-center rounded-full border border-[var(--outline-variant)] h-7 w-7 text-navy-light/60 hover:text-coral hover:border-coral/30 transition-colors"
                                  title="Eliminar comité"
                                  aria-label={`Eliminar comité ${c.name}`}
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
            <p className="text-sm text-navy-light/60 font-body">
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
                <span className="text-[11px] font-bold uppercase tracking-widest text-navy-light/60 font-display">
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
                <button onClick={() => setSelectedCommId(null)} className="text-navy-light/60 hover:text-navy p-1" title="Cerrar" aria-label="Cerrar panel de puestos">
                  <X size={16} />
                </button>
              </div>
            </div>

            {selectedCommPositions.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-10 text-center">
                <LayoutGrid size={26} className="text-navy-light/60" />
                <p className="text-sm text-navy-light/60 font-body">
                  Este comité no tiene puestos
                </p>
                <button onClick={() => setPosModalFor(selectedComm.id)} className="text-[12px] text-coral hover:underline font-body">
                  Crear el primero
                </button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto py-1.5">
                {selectedCommPositions.map((p, i) => {
                  const open = expandedPos.has(p.id)
                  const hasDetail = !!(p.description || p.functions || p.profile || p.study_requirement)
                  return (
                  <div key={p.id} className={cn(i < selectedCommPositions.length - 1 && 'border-b border-[var(--outline-variant)]')}>
                    <div className="group flex items-center gap-2 px-5 py-2.5 hover:bg-surface-low transition-colors">
                      <button
                        onClick={() => togglePos(p.id)}
                        className="flex flex-1 items-center gap-2 text-left min-w-0"
                        aria-expanded={open}
                        aria-label={`${open ? 'Ocultar' : 'Ver'} detalle de ${p.title}`}
                      >
                        {hasDetail
                          ? (open ? <ChevronDown size={14} className="text-navy-light/50 shrink-0" /> : <ChevronRight size={14} className="text-navy-light/50 shrink-0" />)
                          : <span className="w-3.5 shrink-0" />}
                        <span className="flex-1 text-[13px] text-navy font-body truncate">{p.title}</span>
                        {p.study_requirement && (
                          <span className="shrink-0 rounded-full bg-teal-soft/30 px-2 py-0.5 text-[10px] text-teal-deep font-body">{p.study_requirement}</span>
                        )}
                      </button>
                      <button
                        onClick={() => setEditPos(p)}
                        className="rounded-lg p-1.5 text-navy-light/60 hover:text-navy hover:bg-navy/5 transition-colors opacity-0 group-hover:opacity-100"
                        title="Editar puesto" aria-label={`Editar puesto ${p.title}`}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => requestDeletePosition(p)}
                        className="rounded-lg p-1.5 text-navy-light/60 hover:text-coral hover:bg-coral/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Eliminar puesto" aria-label={`Eliminar puesto ${p.title}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {open && (
                      <div className="px-5 pb-4 pt-1 space-y-3 bg-surface-low/40">
                        {p.description && (
                          <div>
                            <p className={labelCls}>Descripción</p>
                            <p className="text-[13px] text-navy-light/80 font-body mt-0.5">{p.description}</p>
                          </div>
                        )}
                        {p.functions && (
                          <div>
                            <p className={labelCls}>Funciones</p>
                            <p className="text-[13px] text-navy-light/80 font-body mt-0.5 whitespace-pre-line leading-relaxed">{p.functions}</p>
                          </div>
                        )}
                        {p.profile && (
                          <div>
                            <p className={labelCls}>Perfil</p>
                            <p className="text-[13px] text-navy-light/80 font-body mt-0.5 whitespace-pre-line leading-relaxed">{p.profile}</p>
                          </div>
                        )}
                        {!hasDetail && <p className="text-[12px] text-navy-light/50 font-body">Sin información descriptiva.</p>}
                      </div>
                    )}
                  </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
