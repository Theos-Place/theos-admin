'use client'

import { useState, use, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, X, Check, ExternalLink } from 'lucide-react'
import { ROLES, assignableRoleIds, type RoleId, type UserAccess, type AccessHistoryEntry } from '@/lib/auth/roles'
import { Modal } from '@/components/shared/Modal'
import { useToast } from '@/components/shared/Toast'
import { useAuth } from '@/hooks/useAuth'
import { formatDate, todayCR, getInitials } from '@/lib/format'

const AVATAR_COLORS = ['#161440', '#EF5554', '#519DA2', '#9B7FD4', '#E9B949', '#3DB97A']
function avatarBg(id: string) {
  return AVATAR_COLORS[id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length]
}

export default function AccesoDetailPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = use(params)
  const toast = useToast()
  const { user: actor } = useAuth()
  // Qué roles puede gestionar el ACTOR logueado (admin: todos; coordinador_estudios:
  // solo los delegados). Filtra la UI para que no aparezcan como editables los que
  // no puede tocar. El server valida igual.
  const allow = assignableRoleIds(actor?.roles ?? [])
  // Quién queda en el historial: la persona logueada. Antes decía "Admin Theos"
  // fijo, así que el historial atribuía todo cambio al mismo nombre inventado.
  const actorName = actor?.name?.trim() || 'Vos'
  const canManageRole = (id: RoleId) => allow === 'all' || allow.has(id)

  const [user, setUser]               = useState<UserAccess | null>(null)
  const [confirmAdd, setConfirmAdd]   = useState<RoleId | null>(null)
  const [history, setHistory]         = useState<AccessHistoryEntry[]>([])

  const [cargando, setCargando] = useState(true)

  // Carga el acceso del miembro desde la BD. /api/accesos solo devuelve a quienes
  // TIENEN roles (la tabla member_roles es la fuente), así que para alguien sin
  // ninguno se arma la ficha desde /api/members/[id]: antes esta pantalla decía
  // "Miembro no encontrado" y no había forma de darle el primer rol desde acá.
  useEffect(() => {
    let alive = true
    async function cargar() {
      try {
        const res = await fetch('/api/accesos')
        const data = res.ok ? ((await res.json()) as UserAccess[]) : []
        const found = Array.isArray(data) ? data.find(u => u.member_id === memberId) ?? null : null
        if (found) {
          if (!alive) return
          setUser(found)
          setHistory(found.history ?? [])
          return
        }
        const mRes = await fetch(`/api/members/${memberId}`)
        if (!mRes.ok) return
        const m = await mRes.json() as { id: string; first_name?: string; last_name?: string; name?: string; email?: string | null }
        if (!alive) return
        const nombre = m.name ?? `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim()
        setUser({
          id: `sin-roles-${memberId}`,
          member_id: memberId,
          member_name: nombre || 'Sin nombre',
          member_email: m.email ?? '',
          member_initials: getInitials(nombre) || '—',
          roles: [],
          granted_by: '',
          granted_at: '',
          last_login: null,
          is_active: false,
        })
        setHistory([])
      } finally {
        if (alive) setCargando(false)
      }
    }
    void cargar()
    return () => { alive = false }
  }, [memberId])

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-navy-light/80 text-sm font-body">Cargando…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <p className="text-navy-light/80 text-sm font-body">Miembro no encontrado</p>
        <Link href="/accesos" className="text-sm text-coral hover:text-coral-deep font-body">
          ← Volver a Accesos
        </Link>
      </div>
    )
  }

  async function handleRevoke(roleId: RoleId) {
    // Optimista con rollback: guardamos el estado previo y lo restauramos si la
    // persistencia falla (un cambio de permisos no debe confirmarse en falso).
    const prevUser = user
    const prevHistory = history
    setUser(prev => prev ? { ...prev, roles: prev.roles.filter(r => r !== roleId) } : prev)
    setHistory(prev => [
      { date: todayCR(), actor: actorName, action: 'revoked', role: roleId },
      ...prev,
    ])
    try {
      const res = await fetch(`/api/accesos/${memberId}/roles`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: roleId }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setUser(prevUser)
      setHistory(prevHistory)
      toast('No se pudo revocar el rol. Intentá de nuevo.', 'error')
    }
  }

  async function handleAddRole(roleId: RoleId) {
    const prevUser = user
    const prevHistory = history
    setUser(prev => prev ? { ...prev, roles: [...prev.roles, roleId], is_active: true } : prev)
    setHistory(prev => [
      { date: todayCR(), actor: actorName, action: 'assigned', role: roleId },
      ...prev,
    ])
    setConfirmAdd(null)
    try {
      const res = await fetch(`/api/accesos/${memberId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: roleId }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setUser(prevUser)
      setHistory(prevHistory)
      toast('No se pudo asignar el rol. Intentá de nuevo.', 'error')
    }
  }

  // 'miembro' es implícito — se excluye de toda la UI de gestión
  const displayRoles   = user.roles.filter(r => r !== 'miembro')
  const availableRoles = ROLES.filter(r => r.id !== 'miembro' && !user.roles.includes(r.id) && canManageRole(r.id))

  return (
    <div className="space-y-6">

      {/* Back */}
      <Link
        href="/accesos"
        className="inline-flex items-center gap-1.5 text-[13px] text-navy-light/80 hover:text-navy-light transition-colors font-body"
      >
        <ChevronLeft size={15} />
        Accesos y Roles
      </Link>

      {/* Header */}
      <div className="rounded-2xl p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-surface-card shadow-card">
        <div className="flex items-center gap-4">
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white shrink-0"
            style={{ background: avatarBg(user.id), fontFamily: 'var(--font-display)' }}
          >
            {user.member_initials}
          </div>
          <div>
            <h1 className="text-xl text-navy font-display font-extrabold tracking-[-0.02em]">
              {user.member_name}
            </h1>
            <p className="text-[13px] text-navy-light/80 font-body">
              {user.member_email}
            </p>
          </div>
        </div>
        <Link
          href={`/miembros/${user.member_id}`}
          className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] text-navy-light hover:bg-surface-low transition-colors shrink-0 border-outline font-body"
        >
          Ver perfil completo
          <ExternalLink size={13} />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Roles actuales */}
      <div className="rounded-2xl p-5 space-y-4 bg-surface-card shadow-card">
        <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display">
          Roles actuales
        </p>

        {displayRoles.length === 0 ? (
          <p className="text-sm text-navy-light/80 py-4 text-center font-body">
            Este miembro no tiene roles adicionales asignados.
          </p>
        ) : (
          <div className="space-y-2">
            {displayRoles.map(rid => {
              const role = ROLES.find(r => r.id === rid)
              if (!role) return null
              const isAutomatic = user.role_origins?.[rid] === 'automatico'
              const positionCount = user.role_position_counts?.[rid] ?? 0
              return (
                <div
                  key={rid}
                  className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 bg-surface-low border border-outline"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ background: role.color }} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy font-body flex items-center gap-1.5 flex-wrap">
                        {role.name}
                        {isAutomatic && (
                          <span
                            className="rounded-full bg-teal-soft/30 px-2 py-0.5 text-[11px] text-teal-deep font-body"
                            title={`Otorgado automáticamente por ${positionCount} puesto${positionCount === 1 ? '' : 's'} de servicio activo${positionCount === 1 ? '' : 's'}.`}
                          >
                            Automático · {positionCount} puesto{positionCount === 1 ? '' : 's'}
                          </span>
                        )}
                      </p>
                      <p className="text-[13px] text-navy-light/80 font-body">{role.description}</p>
                      {isAutomatic && (
                        <p className="text-[13px] text-navy-light/80 font-body mt-0.5">
                          Viene de un puesto de servicio — para quitarlo, sacá a la persona del puesto. Quitarlo acá lo revoca igual, pero puede volver a activarse si el puesto se reasigna.
                        </p>
                      )}
                    </div>
                  </div>
                  {canManageRole(rid) && (
                    <button
                      onClick={() => handleRevoke(rid)}
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-navy-light/80 hover:text-coral hover:bg-coral/10 transition-all shrink-0"
                      aria-label={`Revocar rol ${role.name}`}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Agregar roles */}
      {availableRoles.length > 0 && (
        <div className="rounded-2xl p-5 space-y-4 bg-surface-card shadow-card">
          <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display">
            Agregar rol
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ROLES.filter(r => r.id !== 'miembro' && canManageRole(r.id)).map(role => {
              const assigned = user.roles.includes(role.id)
              return (
                <div
                  key={role.id}
                  className="rounded-xl p-4 border"
                  style={{
                    borderColor: assigned ? `${role.color}40` : 'var(--outline-variant)',
                    background: assigned ? `${role.color}08` : 'var(--surface-low)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: role.color }} />
                    <p className="text-[13px] font-semibold text-navy flex-1 font-body">{role.name}</p>
                  </div>
                  <p className="text-[13px] text-navy-light/80 leading-relaxed mb-3 font-body">
                    {role.description}
                  </p>
                  {assigned ? (
                    <div className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: role.color, fontFamily: 'var(--font-body)' }}>
                      <Check size={13} />
                      Ya asignado
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmAdd(role.id)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-navy-light/80 hover:text-navy hover:bg-white transition-all font-body"
                    >
                      + Agregar este rol
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      </div>

      {/* Historial */}
      <div className="rounded-2xl p-5 space-y-4 bg-surface-card shadow-card">
        <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display">
          Historial de cambios
        </p>
        {history.length === 0 ? (
          <p className="text-sm text-navy-light/80 text-center py-4 font-body">Sin historial</p>
        ) : (
          <div className="relative space-y-0">
            {history.map((entry, i) => {
              const role = ROLES.find(r => r.id === entry.role)
              return (
                <div key={i} className="flex items-start gap-3 pb-4 relative">
                  {i < history.length - 1 && (
                    <div className="absolute left-3.5 top-7 bottom-0 w-px bg-outline" />
                  )}
                  <div
                    className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: entry.action === 'assigned' ? 'rgba(61,185,122,0.12)' : 'rgba(239,85,84,0.10)', border: '2px solid var(--surface-card)', zIndex: 1 }}
                  >
                    {entry.action === 'assigned'
                      ? <Check size={12} className="text-success" />
                      : <X size={12} className="text-coral" />
                    }
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-[13px] text-navy font-body">
                      <span className="font-medium">{entry.actor}</span>{' '}
                      {entry.action === 'assigned' ? 'asignó' : 'revocó'}{' '}
                      <span className="font-medium">“{role?.name ?? entry.role}”</span>
                    </p>
                    <p className="text-[13px] text-navy-light/80 mt-0.5 font-body">
                      {formatDate(entry.date)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Confirm add modal */}
      {confirmAdd && (() => {
        const role = ROLES.find(r => r.id === confirmAdd)
        if (!role) return null
        const perms = role.permissions.map(p => {
          const acts = p.actions.join(', ')
          return p.module === 'all' ? `Todo el sistema (${acts})` : `${p.module} (${acts})`
        }).join(' · ')
        return (
          <Modal onClose={() => setConfirmAdd(null)} titleId="modal-confirmar-rol" width={384}>
            <div className="px-6 py-5">
              <p id="modal-confirmar-rol" className="text-sm font-bold text-navy mb-1 font-display">
                ¿Agregar rol “{role.name}” a {user.member_name.split(' ')[0]}?
              </p>
              <p className="text-[13px] text-navy-light/80 leading-relaxed mb-3 font-body">
                Este rol le dará acceso a: {role.description}
              </p>
              <div className="rounded-lg px-3 py-2.5 text-[13px] text-navy-light/80 leading-relaxed bg-surface-low font-body">
                {perms}
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 border-outline">
              <button
                onClick={() => setConfirmAdd(null)}
                className="flex-1 rounded-full border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors border-outline font-body"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleAddRole(confirmAdd)}
                className="flex-1 rounded-full bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body"
              >
                Confirmar
              </button>
            </div>
          </Modal>
        )
      })()}
    </div>
  )
}
