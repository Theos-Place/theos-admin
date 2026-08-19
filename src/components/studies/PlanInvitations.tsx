'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, UserPlus } from 'lucide-react'
import { MemberCombobox, type MemberHit } from '@/components/shared/MemberCombobox'
import { useToast } from '@/components/shared/Toast'
import { getInitials } from '@/lib/format'
import { cn } from '@/lib/utils'

type Invitation = {
  id: string
  member_id: string
  member_name: string
  status: 'active' | 'revoked' | 'used'
  invited_by_name: string | null
  created_at: string
}

const STATUS_LABEL: Record<Invitation['status'], { label: string; cls: string }> = {
  active: { label: 'Activa', cls: 'bg-teal-soft/30 text-teal-deep' },
  used: { label: 'Matriculado', cls: 'bg-navy/10 text-navy' },
  revoked: { label: 'Revocada', cls: 'bg-surface-low text-navy-light/80' },
}

/** Sección "Invitados" del detalle de un plan invitation_only. Solo para roles de estudios. */
export function PlanInvitations({ planId }: { planId: string }) {
  const toast = useToast()
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/studies/invitations?plan_id=${planId}`)
      .then(r => (r.ok ? r.json() : { invitations: [] }))
      .then(d => setInvitations(d.invitations ?? []))
      .catch(() => setInvitations([]))
      .finally(() => setLoading(false))
  }, [planId])

  useEffect(() => { load() }, [load])

  async function invite(m: MemberHit) {
    setAdding(true)
    try {
      const res = await fetch('/api/studies/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: m.id, plan_id: planId }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      load()
    } catch (e) {
      console.error('No se pudo invitar:', e)
      toast(`No se pudo invitar a ${m.first_name} ${m.last_name} al estudio. Intentá de nuevo.`, 'error')
    } finally {
      setAdding(false)
    }
  }

  async function revoke(id: string) {
    try {
      const res = await fetch(`/api/studies/invitations?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setInvitations(prev => prev.map(i => i.id === id ? { ...i, status: 'revoked' } : i))
    } catch (e) {
      console.error('No se pudo revocar:', e)
      toast('No se pudo revocar la invitación. Intentá de nuevo.', 'error')
    }
  }

  const activeIds = invitations.filter(i => i.status === 'active').map(i => i.member_id)

  return (
    <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-4">
      <div className="flex items-center gap-2">
        <UserPlus size={16} className="text-coral" />
        <h3 className="text-sm font-semibold text-navy font-display">Invitados a este estudio</h3>
      </div>
      <p className="text-[13px] text-navy-light/80 font-body">
        Este estudio es solo por invitación. Solo las personas invitadas pueden matricularse.
      </p>

      <MemberCombobox onSelect={invite} placeholder="Buscar miembro para invitar…" excludeIds={activeIds} />
      {adding && <p className="text-[13px] text-navy-light/80 font-body">Invitando…</p>}

      <div className="space-y-1.5">
        {loading ? (
          <p className="text-[13px] text-navy-light/80 font-body">Cargando…</p>
        ) : invitations.length === 0 ? (
          <p className="text-[13px] text-navy-light/80 font-body">Todavía no hay invitados.</p>
        ) : invitations.map(inv => (
          <div key={inv.id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface-low transition-colors">
            <div className="h-8 w-8 rounded-full bg-navy flex items-center justify-center text-[11px] font-bold text-white shrink-0">
              {getInitials(inv.member_name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-navy truncate font-body">{inv.member_name}</p>
              {inv.invited_by_name && <p className="text-[13px] text-navy-light/80 font-body">Invitado por {inv.invited_by_name}</p>}
            </div>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold font-display', STATUS_LABEL[inv.status].cls)}>
              {STATUS_LABEL[inv.status].label}
            </span>
            {inv.status === 'active' && (
              <button
                onClick={() => revoke(inv.id)}
                aria-label={`Revocar invitación de ${inv.member_name}`}
                title="Revocar"
                className="shrink-0 h-7 w-7 flex items-center justify-center rounded-lg text-navy-light/50 hover:text-coral hover:bg-coral/5 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
