'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Search, UserPlus, Check, AlertTriangle, ChevronDown } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { MemberCombobox, type MemberHit } from '@/components/shared/MemberCombobox'
import { ROLES, type RoleId, type UserAccess } from '@/lib/auth/roles'
import { cn } from '@/lib/utils'
import { TOAST_MS } from '@/lib/constants'
import { formatDate, initialsFromParts } from '@/lib/format'
import { useClientPagination } from '@/hooks/useClientPagination'
import { LoadMoreFooter } from '@/components/shared/LoadMoreFooter'

function RoleBadge({ roleId, small }: { roleId: RoleId; small?: boolean }) {
  const role = ROLES.find(r => r.id === roleId)
  if (!role) return null
  return (
    <span
      className={cn('inline-flex items-center rounded-full font-medium', small ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]')}
      style={{ background: `${role.color}18`, color: role.color, border: `1px solid ${role.color}30` }}
    >
      {role.name}
    </span>
  )
}

const AVATAR_COLORS = ['#161440', '#EF5554', '#519DA2', '#9B7FD4', '#E9B949', '#3DB97A']
function avatarBg(id: string) {
  return AVATAR_COLORS[id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length]
}

export default function AccesosPage() {
  const router = useRouter()
  const [search, setSearch]           = useState('')
  const [roleFilter, setRoleFilter]   = useState<RoleId | ''>('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [showModal, setShowModal]     = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState<UserAccess | null>(null)
  const [users, setUsers]             = useState<UserAccess[]>([])
  const [toastMsg, setToastMsg]       = useState('')

  // Carga los miembros con roles asignados desde la BD.
  useEffect(() => {
    fetch('/api/accesos')
      .then(r => (r.ok ? r.json() : []))
      .then(data => { if (Array.isArray(data)) setUsers(data as UserAccess[]) })
      .catch(() => {})
  }, [])

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), TOAST_MS)
  }

  const activeCount    = users.filter(u => u.is_active).length
  const usedRoles      = new Set(users.filter(u => u.is_active).flatMap(u => u.roles)).size
  const lastLoginDates = users.map(u => u.last_login).filter(Boolean) as string[]
  const latestLogin    = lastLoginDates.sort().reverse()[0] ?? null

  const filtered = useMemo(() => {
    return users.filter(u => {
      const q = search.toLowerCase()
      const matchSearch = !q || u.member_name.toLowerCase().includes(q) || u.member_email.toLowerCase().includes(q)
      const matchRole   = !roleFilter || u.roles.includes(roleFilter as RoleId)
      const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? u.is_active : !u.is_active)
      return matchSearch && matchRole && matchStatus
    })
  }, [users, search, roleFilter, statusFilter])

  // Lista acotada (solo miembros con rol asignado) → paginación de vista, patrón /miembros.
  const usersPage = useClientPagination(filtered, 15)

  function handleRevoke(u: UserAccess) {
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, roles: [], is_active: false } : x))
    setConfirmRevoke(null)
    showToast(`Accesos revocados para ${u.member_name}`)
  }

  function handleAccessGranted(memberId: string, memberName: string, memberEmail: string, memberInitials: string, roles: RoleId[]) {
    const existing = users.find(u => u.member_id === memberId)
    if (existing) {
      setUsers(prev => prev.map(u => u.id === existing.id ? { ...u, roles: [...new Set([...u.roles, ...roles])], is_active: true } : u))
    } else {
      const newEntry: UserAccess = {
        id: `access-new-${Date.now()}`,
        member_id: memberId,
        member_name: memberName,
        member_email: memberEmail,
        member_initials: memberInitials,
        roles,
        granted_by: 'Admin Theos',
        granted_at: new Date().toISOString().split('T')[0],
        last_login: null,
        is_active: true,
      }
      setUsers(prev => [...prev, newEntry])
    }
    showToast(`Acceso otorgado · Notificación enviada a ${memberName}`)
    setShowModal(false)
  }

  return (
    <div className="space-y-6">

      {/* Header strip */}
      <div className="rounded-2xl bg-navy px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shadow-card">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-white/10">
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl text-white font-display font-extrabold tracking-[-0.02em]">
              Accesos y Roles
            </h1>
            <p className="text-[12px] text-white/70 mt-0.5 font-body">
              Gestión de permisos administrativos del sistema
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-full bg-coral px-4 py-2.5 text-sm text-white hover:bg-coral-deep transition-all shrink-0 font-body shadow-[0_8px_24px_rgba(239,85,84,0.30)]"
        >
          <UserPlus size={15} />
          Dar acceso
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Usuarios con acceso activo', value: activeCount,              color: 'text-navy' },
          { label: 'Roles distintos en uso',     value: usedRoles,                color: 'text-teal-deep' },
          { label: 'Último acceso',              value: formatDate(latestLogin),  color: 'text-navy', isText: true },
        ].map(({ label, value, color, isText }) => (
          <div key={label} className="rounded-2xl p-5 bg-surface-card shadow-card">
            <p className="text-[10px] tracking-widests uppercase text-navy-light/60 mb-2 font-display">{label}</p>
            <p className={cn('font-extrabold', isText ? 'text-2xl' : 'text-4xl', color, 'font-display')}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Referencia de roles (al inicio, antes de la lista de usuarios) */}
      <div>
        <p className="text-[10px] uppercase tracking-widests text-navy-light/60 mb-3 font-display">
          Referencia de roles
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {ROLES.filter(r => r.id !== 'miembro').map(role => (
            <div
              key={role.id}
              className="rounded-xl p-4 border bg-surface-card border-outline"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="h-3 w-3 rounded-full shrink-0" style={{ background: role.color }} />
                <p className="text-[13px] font-semibold text-navy font-body">{role.name}</p>
              </div>
              <p className="text-[12px] text-navy-light/55 leading-relaxed font-body">{role.description}</p>
            </div>
          ))}
        </div>

        {/* Rol miembro — separado, con nota */}
        <div className="mt-4 pt-4 border-t border-outline">
          {(() => {
            const miembro = ROLES.find(r => r.id === 'miembro')
            if (!miembro) return null
            return (
              <div className="flex items-start gap-3 rounded-xl p-4 border bg-navy/2 border-outline">
                <div className="h-3 w-3 rounded-full mt-0.5 shrink-0" style={{ background: miembro.color }} />
                <div>
                  <p className="text-[13px] font-semibold text-navy font-body">{miembro.name}</p>
                  <p className="text-[12px] text-navy-light/55 leading-relaxed mb-1.5 font-body">{miembro.description}</p>
                  <span className="inline-flex text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#9CA0B4]/15 text-[#9CA0B4] font-body">
                    Asignado automáticamente a todos — no requiere gestión manual
                  </span>
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 rounded-xl bg-surface-card px-3 py-2.5 flex-1 max-w-sm border border-outline">
          <Search size={15} className="text-navy-light/60 shrink-0" />
          <input
            type="search"
            placeholder="Buscar por nombre o correo..."
            aria-label="Buscar por nombre o correo"
            className="flex-1 bg-transparent text-sm text-navy placeholder-navy-light/50 outline-none font-body"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="rounded-xl border px-3 py-2.5 text-sm text-navy-light bg-surface-card outline-none border-outline font-body"
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value as RoleId | '')}
        >
          <option value="">Todos los roles</option>
          {ROLES.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <div className="flex gap-1.5">
          {(['all', 'active', 'inactive'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'rounded-full px-3.5 py-2 text-[12px] font-medium border transition-all',
                statusFilter === s ? 'bg-navy text-white border-navy' : 'text-navy-light/60 border-transparent hover:border-navy/20 hover:text-navy'
              , 'font-display')}
            >
              {s === 'all' ? 'Todos' : s === 'active' ? 'Activos' : 'Inactivos'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden bg-surface-card shadow-card">
        {/* Info note */}
        <div
          className="flex items-center gap-2 px-5 py-3 border-b text-[12px] text-navy-light/60 border-outline bg-navy/2 font-body"
        >
          <span className="text-teal-deep shrink-0">ℹ️</span>
          Todos los miembros tienen el rol <span className="font-medium text-navy-light/80">"Miembro"</span> por defecto. Los roles adicionales amplían sus permisos.
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-outline">
                {['Miembro', 'Roles', 'Otorgado por', 'Desde', 'Último login', 'Estado', ''].map(h => (
                  <th
                    key={h}
                    className="px-5 py-3.5 text-left text-[10px] uppercase tracking-widests text-navy-light/60 font-display whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usersPage.visible.map(u => (
                <tr
                  key={u.id}
                  className="border-b hover:bg-surface-low/50 transition-colors cursor-pointer border-outline"
                  onClick={() => router.push(`/accesos/${u.member_id}`)}
                >
                  {/* Miembro */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white"
                        style={{ background: avatarBg(u.id), fontFamily: 'var(--font-display)' }}
                      >
                        {u.member_initials}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-navy font-body">{u.member_name}</p>
                        <p className="text-[12px] text-navy-light/60 font-body">{u.member_email}</p>
                      </div>
                    </div>
                  </td>
                  {/* Roles acumulados — los miembros sin roles extra se muestran como "Miembro" */}
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(() => {
                        const extra = u.roles.filter(r => r !== 'miembro')
                        if (extra.length === 0) return <RoleBadge roleId="miembro" small />
                        return extra.map(rid => <RoleBadge key={rid} roleId={rid} small />)
                      })()}
                    </div>
                  </td>
                  {/* Otorgado por */}
                  <td className="px-5 py-4">
                    <p className="text-[13px] text-navy-light/70 whitespace-nowrap font-body">{u.granted_by}</p>
                  </td>
                  {/* Desde */}
                  <td className="px-5 py-4">
                    <p className="text-[13px] text-navy-light/60 whitespace-nowrap font-body">{formatDate(u.granted_at)}</p>
                  </td>
                  {/* Último login */}
                  <td className="px-5 py-4">
                    <p className={cn('text-[13px] whitespace-nowrap', u.last_login ? 'text-navy-light/60' : 'text-navy-light/60', 'font-body')}>
                      {formatDate(u.last_login)}
                    </p>
                  </td>
                  {/* Estado */}
                  <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                    <span
                      className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium', u.is_active ? 'text-emerald-700' : 'text-navy-light/60')}
                      style={{ background: u.is_active ? 'rgba(61,185,122,0.10)' : 'rgba(22,20,64,0.06)' }}
                    >
                      {u.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  {/* Acciones */}
                  <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => router.push(`/accesos/${u.member_id}`)}
                        className="rounded-lg border px-3 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors whitespace-nowrap border-outline font-body"
                      >
                        Editar roles
                      </button>
                      {u.is_active && u.roles.length > 0 && (
                        <button
                          onClick={() => setConfirmRevoke(u)}
                          className="rounded-lg border px-3 py-1.5 text-[12px] text-coral hover:bg-coral/5 transition-colors whitespace-nowrap border-coral/30 font-body"
                        >
                          Revocar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-navy-light/60 font-body">
                    No hay usuarios que coincidan con los filtros
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile: tarjetas */}
        <ul className="md:hidden divide-y border-outline">
          {usersPage.visible.map(u => {
            const extra = u.roles.filter(r => r !== 'miembro')
            return (
              <li
                key={u.id}
                onClick={() => router.push(`/accesos/${u.member_id}`)}
                className="flex items-center gap-3 px-4 py-3 active:bg-surface-low cursor-pointer"
              >
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white"
                  style={{ background: avatarBg(u.id), fontFamily: 'var(--font-display)' }}
                >
                  {u.member_initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-navy font-body">{u.member_name}</p>
                  <p className="truncate text-[12px] text-navy-light/60 font-body">
                    {extra.length === 0 ? 'Miembro' : extra.map(rid => ROLES.find(r => r.id === rid)?.name ?? rid).join(', ')}
                  </p>
                </div>
                <span
                  className={cn('shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium', u.is_active ? 'text-emerald-700' : 'text-navy-light/60')}
                  style={{ background: u.is_active ? 'rgba(61,185,122,0.10)' : 'rgba(22,20,64,0.06)' }}
                >
                  {u.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </li>
            )
          })}
          {filtered.length === 0 && (
            <li className="px-4 py-12 text-center text-sm text-navy-light/60 font-body">
              No hay usuarios que coincidan con los filtros
            </li>
          )}
        </ul>
        {filtered.length > 0 && (
          <LoadMoreFooter
            shown={usersPage.shown}
            total={usersPage.total}
            hasMore={usersPage.hasMore}
            loading={false}
            onLoadMore={usersPage.loadMore}
            noun="usuarios"
            increment={15}
          />
        )}
      </div>

      {/* Confirm revoke modal */}
      {confirmRevoke && (
        <Modal onClose={() => setConfirmRevoke(null)} titleId="confirm-revoke-title" width={384}>
          <div className="px-6 py-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-coral/10">
                <AlertTriangle size={18} className="text-coral" />
              </div>
              <div>
                <p id="confirm-revoke-title" className="text-sm font-bold text-navy font-display">¿Revocar todos los accesos?</p>
                <p className="text-[12px] text-navy-light/60 font-body">Esta acción es reversible</p>
              </div>
            </div>
            <p className="text-[13px] text-navy-light/70 leading-relaxed font-body">
              <strong>{confirmRevoke.member_name}</strong> perderá acceso al sistema de inmediato.
            </p>
          </div>
          <div className="px-6 py-4 border-t flex gap-3 border-outline">
            <button
              onClick={() => setConfirmRevoke(null)}
              className="flex-1 rounded-full border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors border-outline font-body"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleRevoke(confirmRevoke)}
              className="flex-1 rounded-full bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body"
            >
              Revocar accesos
            </button>
          </div>
        </Modal>
      )}

      {/* Dar acceso modal */}
      {showModal && (
        <DarAccesoModal
          existingIds={users.map(u => u.member_id)}
          onClose={() => setShowModal(false)}
          onConfirm={handleAccessGranted}
        />
      )}

      {/* Toast */}
      {toastMsg && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm text-white bg-navy shadow-[0_12px_32px_rgba(22,20,64,0.20)] font-body"
        >
          <Check size={15} className="text-teal shrink-0" />
          {toastMsg}
        </div>
      )}
    </div>
  )
}

/* ── Modal 2 pasos ── */
function DarAccesoModal({
  existingIds,
  onClose,
  onConfirm,
}: {
  existingIds: string[]
  onClose: () => void
  onConfirm: (memberId: string, name: string, email: string, initials: string, roles: RoleId[]) => void
}) {
  const [step, setStep]               = useState<1 | 2>(1)
  const [selected, setSelected]       = useState<MemberHit | null>(null)
  const [selectedRoles, setSelectedRoles] = useState<Set<RoleId>>(new Set())

  const AVATAR_COLORS2 = ['#161440', '#EF5554', '#519DA2', '#9B7FD4', '#E9B949']
  function aBg(id: string) { return AVATAR_COLORS2[id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS2.length] }

  function toggleRole(id: RoleId) {
    setSelectedRoles(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function handleConfirm() {
    if (!selected || selectedRoles.size === 0) return
    const initials = initialsFromParts(selected.first_name, selected.last_name)
    onConfirm(selected.id, `${selected.first_name} ${selected.last_name}`, selected.email ?? '', initials, [...selectedRoles])
  }

  return (
    <Modal onClose={onClose} titleId="dar-acceso-title" width={512}>
      <div className="flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline">
          <div>
            <p id="dar-acceso-title" className="text-sm font-bold text-navy font-display">
              Dar acceso al sistema
            </p>
            <p className="text-[11px] text-navy-light/60 mt-0.5 font-body">
              Paso {step} de 2 — {step === 1 ? 'Buscar miembro' : 'Asignar roles'}
            </p>
          </div>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {selected ? (
              <div className="flex items-center gap-3 rounded-xl p-4 bg-teal/8 border border-teal/25">
                <div className="h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: aBg(selected.id), fontFamily: 'var(--font-display)' }}>
                  {selected.first_name[0]}{selected.last_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy font-body">{selected.first_name} {selected.last_name}</p>
                  <p className="text-[12px] text-navy-light/60 font-body">{selected.email}</p>
                </div>
                <button onClick={() => setSelected(null)} aria-label="Quitar miembro seleccionado" className="text-[11px] text-coral hover:underline font-body shrink-0">
                  Cambiar
                </button>
              </div>
            ) : (
              <MemberCombobox
                autoFocus
                pageSize={6}
                excludeIds={existingIds}
                placeholder="Buscar por nombre o cédula..."
                onSelect={setSelected}
                secondaryText={m => [m.cedula, m.email].filter(Boolean).join(' · ') || 'Sin cédula'}
              />
            )}
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <p className="text-[12px] text-navy-light/60 font-body">
              Seleccioná uno o más roles para <strong className="text-navy">{selected?.first_name} {selected?.last_name}</strong>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ROLES.map(role => {
                const isSelected = selectedRoles.has(role.id)
                return (
                  <button
                    key={role.id}
                    onClick={() => toggleRole(role.id)}
                    className="text-left rounded-xl p-3.5 border transition-all"
                    style={{
                      borderColor: isSelected ? '#EF5554' : 'var(--outline-variant)',
                      background: isSelected ? 'rgba(239,85,84,0.05)' : 'var(--surface-low)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: role.color }} />
                      <p className="text-[13px] font-semibold text-navy font-body">{role.name}</p>
                      {isSelected && <Check size={13} className="text-coral ml-auto shrink-0" />}
                    </div>
                    <p className="text-[11px] text-navy-light/60 leading-relaxed font-body">{role.description}</p>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t flex gap-3 border-outline">
          {step === 2 && (
            <button
              onClick={() => setStep(1)}
              className="flex-1 rounded-full border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors border-outline font-body"
            >
              Atrás
            </button>
          )}
          {step === 1 && (
            <button
              onClick={onClose}
              className="flex-1 rounded-full border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors border-outline font-body"
            >
              Cancelar
            </button>
          )}
          <button
            disabled={step === 1 ? !selected : selectedRoles.size === 0}
            onClick={() => step === 1 ? setStep(2) : handleConfirm()}
            className="flex-1 rounded-full bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-all disabled:opacity-40 disabled:cursor-not-allowed font-body"
          >
            {step === 1 ? 'Continuar →' : `Dar acceso (${selectedRoles.size} rol${selectedRoles.size !== 1 ? 'es' : ''})`}
          </button>
        </div>
      </div>
    </Modal>
  )
}
