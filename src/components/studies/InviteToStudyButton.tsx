'use client'

import { useState, useMemo } from 'react'
import { Mail } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { useStudyPlans } from '@/hooks/useStudyPlans'
import { useAuth } from '@/hooks/useAuth'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'

/** Botón "Invitar a estudio" en el perfil — solo roles de estudios. Invita al
 *  miembro a un estudio invitation_only (study_plans.requires_invitation).
 *  `blocked` = el miembro está marcado "no recomendado para dar estudios":
 *  no puede recibir invitaciones (CDEB u otro invitation_only) — guard de UI,
 *  el server también lo rechaza aunque se salte esto. */
export function InviteToStudyButton({
  memberId, memberName = 'esta persona', blocked = false,
}: { memberId: string; memberName?: string; blocked?: boolean }) {
  const { hasRole, loaded } = useAuth()
  const { studyTypes } = useStudyPlans()
  const [open, setOpen] = useState(false)
  const [planId, setPlanId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Planes por invitación, activos. (StudyType.plan_id = id real del plan.)
  const invitationPlans = useMemo(
    () => studyTypes.filter(s => s.requires_invitation && !s.is_archived),
    [studyTypes],
  )

  if (loaded && !hasRole(...STUDY_ADMIN_ROLES)) return null
  if (invitationPlans.length === 0) return null

  if (blocked) {
    return (
      <p className="text-[12px] text-navy-light/60 font-body italic">
        No recomendado para dar estudios: no se puede invitar a la formación de dirigentes (CDEB).
      </p>
    )
  }

  async function submit() {
    if (!planId || saving) return
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/studies/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId, plan_id: planId, notes: notes.trim() || null }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setDone(true)
    } catch (e) {
      console.error('No se pudo invitar:', e)
      setError('No se pudo crear la invitación. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  function close() { setOpen(false); setPlanId(''); setNotes(''); setDone(false); setError(null) }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-[var(--outline-variant)] px-4 py-2 text-sm text-navy hover:bg-surface-low transition-colors font-body"
      >
        <Mail size={15} /> Invitar a estudio
      </button>

      {open && (
        <Modal onClose={close} titleId="invitar-estudio-titulo" width={420}>
          <div className="p-6 space-y-4">
            <h3 id="invitar-estudio-titulo" className="text-lg font-extrabold text-navy font-display">Invitar a un estudio</h3>
            {done ? (
              <div className="space-y-4">
                <p className="text-sm text-navy-light/70 font-body">
                  Listo. {memberName} quedó invitado y ya puede matricularse en ese estudio (aparece con el sello “Por invitación”).
                </p>
                <button onClick={close} className="w-full rounded-full bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body">Entendido</button>
              </div>
            ) : (
              <>
                <p className="text-sm text-navy-light/60 font-body">
                  Estos estudios son solo por invitación. Al invitar a {memberName}, podrá matricularse.
                </p>
                <div className="space-y-1">
                  <label className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display">Estudio</label>
                  <select
                    value={planId}
                    onChange={e => setPlanId(e.target.value)}
                    className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
                  >
                    <option value="">Seleccionar estudio…</option>
                    {invitationPlans.map(p => <option key={p.plan_id ?? p.code} value={p.plan_id ?? ''}>{p.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display">Nota (opcional)</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body resize-none"
                    placeholder="Motivo de la invitación…"
                  />
                </div>
                {error && <p className="text-[12px] text-coral font-body">{error}</p>}
                <div className="flex gap-2">
                  <button onClick={close} className="flex-1 rounded-full border border-[var(--outline-variant)] py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body">Cancelar</button>
                  <button onClick={submit} disabled={!planId || saving} className="flex-1 rounded-full bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40 font-body">{saving ? 'Invitando…' : 'Invitar'}</button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
