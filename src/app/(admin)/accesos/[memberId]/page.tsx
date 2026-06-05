'use client'

import { useState, use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, X, Check, ExternalLink } from 'lucide-react'
import { ROLES, type RoleId, type UserAccess, type AccessHistoryEntry } from '@/data/mock-auth'
import { cn } from '@/lib/utils'

function RoleBadge({ roleId }: { roleId: RoleId }) {
  const role = ROLES.find(r => r.id === roleId)
  if (!role) return null
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{ background: `${role.color}18`, color: role.color, border: `1px solid ${role.color}30` }}
    >
      {role.name}
    </span>
  )
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' })
}
function formatDateTime(d: string) {
  const dt = new Date(d)
  const date = dt.toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })
  return date
}

const AVATAR_COLORS = ['#161440', '#EF5554', '#519DA2', '#9B7FD4', '#E9B949', '#3DB97A']
function avatarBg(id: string) {
  return AVATAR_COLORS[id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length]
}

export default function AccesoDetailPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = use(params)
  const router = useRouter()

  const [user, setUser]               = useState<UserAccess | null>(null)
  const [confirmAdd, setConfirmAdd]   = useState<RoleId | null>(null)
  const [history, setHistory]         = useState<AccessHistoryEntry[]>([])

  // Carga el acceso del miembro desde la BD.
  useEffect(() => {
    fetch('/api/accesos')
      .then(r => (r.ok ? r.json() : []))
      .then((data: UserAccess[]) => {
        const found = Array.isArray(data) ? data.find(u => u.member_id === memberId) ?? null : null
        setUser(found)
        setHistory(found?.history ?? [])
      })
      .catch(() => {})
  }, [memberId])

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <p className="text-navy-light/50 text-sm" style={{ fontFamily: 'var(--font-body)' }}>Miembro no encontrado</p>
        <Link href="/accesos" className="text-sm text-coral hover:text-coral-deep" style={{ fontFamily: 'var(--font-body)' }}>
          ← Volver a Accesos
        </Link>
      </div>
    )
  }

  function handleRevoke(roleId: RoleId) {
    setUser(prev => prev ? { ...prev, roles: prev.roles.filter(r => r !== roleId) } : prev)
    setHistory(prev => [
      { date: new Date().toISOString().split('T')[0], actor: 'Admin Theos', action: 'revoked', role: roleId },
      ...prev,
    ])
  }

  function handleAddRole(roleId: RoleId) {
    setUser(prev => prev ? { ...prev, roles: [...prev.roles, roleId], is_active: true } : prev)
    setHistory(prev => [
      { date: new Date().toISOString().split('T')[0], actor: 'Admin Theos', action: 'assigned', role: roleId },
      ...prev,
    ])
    setConfirmAdd(null)
  }

  // 'miembro' es implícito — se excluye de toda la UI de gestión
  const displayRoles   = user.roles.filter(r => r !== 'miembro')
  const availableRoles = ROLES.filter(r => r.id !== 'miembro' && !user.roles.includes(r.id))

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Back */}
      <Link
        href="/accesos"
        className="inline-flex items-center gap-1.5 text-[13px] text-navy-light/40 hover:text-navy-light transition-colors"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        <ChevronLeft size={15} />
        Accesos y Roles
      </Link>

      {/* Header */}
      <div className="rounded-2xl p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <div className="flex items-center gap-4">
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white shrink-0"
            style={{ background: avatarBg(user.id), fontFamily: 'var(--font-display)' }}
          >
            {user.member_initials}
          </div>
          <div>
            <h1 className="text-xl text-navy" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}>
              {user.member_name}
            </h1>
            <p className="text-[13px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
              {user.member_email}
            </p>
          </div>
        </div>
        <Link
          href={`/miembros/${user.member_id}`}
          className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] text-navy-light hover:bg-surface-low transition-colors shrink-0"
          style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
        >
          Ver perfil completo
          <ExternalLink size={13} />
        </Link>
      </div>

      {/* Roles actuales */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <p className="text-[10px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
          Roles actuales
        </p>

        {displayRoles.length === 0 ? (
          <p className="text-sm text-navy-light/40 py-4 text-center" style={{ fontFamily: 'var(--font-body)' }}>
            Este miembro no tiene roles adicionales asignados.
          </p>
        ) : (
          <div className="space-y-2">
            {displayRoles.map(rid => {
              const role = ROLES.find(r => r.id === rid)
              if (!role) return null
              return (
                <div
                  key={rid}
                  className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
                  style={{ background: 'var(--surface-low)', border: '1px solid var(--outline-variant)' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ background: role.color }} />
                    <div>
                      <p className="text-sm font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>{role.name}</p>
                      <p className="text-[12px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>{role.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevoke(rid)}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-navy-light/30 hover:text-coral hover:bg-coral/10 transition-all shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Agregar roles */}
      {availableRoles.length > 0 && (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
          <p className="text-[10px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
            Agregar rol
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ROLES.filter(r => r.id !== 'miembro').map(role => {
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
                    <p className="text-[13px] font-semibold text-navy flex-1" style={{ fontFamily: 'var(--font-body)' }}>{role.name}</p>
                  </div>
                  <p className="text-[11px] text-navy-light/50 leading-relaxed mb-3" style={{ fontFamily: 'var(--font-body)' }}>
                    {role.description}
                  </p>
                  {assigned ? (
                    <div className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: role.color, fontFamily: 'var(--font-body)' }}>
                      <Check size={13} />
                      Ya asignado
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmAdd(role.id)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-navy-light/70 hover:text-navy hover:bg-white transition-all"
                      style={{ fontFamily: 'var(--font-body)' }}
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

      {/* Historial */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <p className="text-[10px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
          Historial de cambios
        </p>
        {history.length === 0 ? (
          <p className="text-sm text-navy-light/40 text-center py-4" style={{ fontFamily: 'var(--font-body)' }}>Sin historial</p>
        ) : (
          <div className="relative space-y-0">
            {history.map((entry, i) => {
              const role = ROLES.find(r => r.id === entry.role)
              return (
                <div key={i} className="flex items-start gap-3 pb-4 relative">
                  {i < history.length - 1 && (
                    <div className="absolute left-3.5 top-7 bottom-0 w-px" style={{ background: 'var(--outline-variant)' }} />
                  )}
                  <div
                    className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: entry.action === 'assigned' ? 'rgba(61,185,122,0.12)' : 'rgba(239,85,84,0.10)', border: '2px solid var(--surface-card)', zIndex: 1 }}
                  >
                    {entry.action === 'assigned'
                      ? <Check size={12} style={{ color: '#3DB97A' }} />
                      : <X size={12} className="text-coral" />
                    }
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-[13px] text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                      <span className="font-medium">{entry.actor}</span>{' '}
                      {entry.action === 'assigned' ? 'asignó' : 'revocó'}{' '}
                      <span className="font-medium">"{role?.name ?? entry.role}"</span>
                    </p>
                    <p className="text-[11px] text-navy-light/40 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
                      {formatDateTime(entry.date)}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-ink/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-lg)' }}>
              <div className="px-6 py-5">
                <p className="text-sm font-bold text-navy mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                  ¿Agregar rol "{role.name}" a {user.member_name.split(' ')[0]}?
                </p>
                <p className="text-[12px] text-navy-light/55 leading-relaxed mb-3" style={{ fontFamily: 'var(--font-body)' }}>
                  Este rol le dará acceso a: {role.description}
                </p>
                <div className="rounded-lg px-3 py-2.5 text-[11px] text-navy-light/60 leading-relaxed" style={{ background: 'var(--surface-low)', fontFamily: 'var(--font-body)' }}>
                  {perms}
                </div>
              </div>
              <div className="px-6 py-4 border-t flex gap-3" style={{ borderColor: 'var(--outline-variant)' }}>
                <button
                  onClick={() => setConfirmAdd(null)}
                  className="flex-1 rounded-full border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors"
                  style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleAddRole(confirmAdd)}
                  className="flex-1 rounded-full bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
