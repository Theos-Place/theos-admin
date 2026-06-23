'use client'

import { useState, useEffect, useCallback } from 'react'
import { ShieldCheck, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import { InviteToStudyButton } from '@/components/studies/InviteToStudyButton'
import { StudyExceptionButton } from '@/components/studies/StudyExceptionButton'
import { MemberRecommendations } from './MemberRecommendations'

type AdminData = {
  approved_to_lead_studies: boolean
  approved_at: string | null
  approved_by_name: string | null
  can_edit: boolean
}

/** Tab "Administrativo": SOLO roles administrativos (el miembro nunca lo ve, ni
 *  el tab ni los datos). Acciones de estudios + "Aprobado para dar estudios" +
 *  recomendaciones de cierres (todas). */
export function MemberAdminTab({ memberId }: { memberId: string }) {
  const [admin, setAdmin] = useState<AdminData | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadAdmin = useCallback(() => {
    return fetch(`/api/members/${memberId}/admin-data`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: AdminData) => setAdmin(d))
      .catch(() => setError('No se pudieron cargar los datos administrativos.'))
  }, [memberId])

  useEffect(() => { loadAdmin() }, [loadAdmin])

  async function toggleApproved() {
    if (!admin || busy || !admin.can_edit) return
    setBusy(true)
    setSaved(false)
    try {
      const res = await fetch(`/api/members/${memberId}/admin-data`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved_to_lead_studies: !admin.approved_to_lead_studies }),
      })
      if (!res.ok) throw new Error()
      await loadAdmin()
      setSaved(true)
    } catch {
      setError('No se pudo actualizar la aprobación.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Acciones de estudios (movidas desde Participación) */}
      <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]">
        <p className="text-[10px] uppercase tracking-wider text-navy-light/70 font-display mb-3">Acciones de estudios</p>
        <div className="flex gap-2 flex-wrap">
          <InviteToStudyButton memberId={memberId} />
          <StudyExceptionButton memberId={memberId} />
        </div>
      </div>

      {/* Aprobado para dar estudios */}
      <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={15} className="text-teal-deep" />
          <p className="text-[10px] uppercase tracking-wider text-navy-light/70 font-display">Aprobación para dar estudios</p>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-navy font-body">Aprobado para dar estudios</p>
            <p className="text-[12px] text-navy-light/70 mt-0.5 font-body">
              {admin?.can_edit ? 'Habilita a esta persona como dirigente de estudios.' : 'Solo coordinación de estudios o admin puede cambiarlo.'}
            </p>
            {admin?.approved_to_lead_studies && admin.approved_by_name && (
              <p className="text-[11px] text-navy-light/60 mt-1 font-body">
                Aprobado por {admin.approved_by_name}{admin.approved_at ? ` · ${formatDate(admin.approved_at)}` : ''}
              </p>
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!admin?.approved_to_lead_studies}
            disabled={!admin?.can_edit || busy}
            onClick={toggleApproved}
            className={cn(
              'relative h-6 w-11 rounded-full transition-colors shrink-0 mt-0.5',
              admin?.approved_to_lead_studies ? 'bg-coral' : 'bg-navy/20',
              (!admin?.can_edit || busy) && 'opacity-50 cursor-not-allowed',
            )}
          >
            <span className={cn('absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', admin?.approved_to_lead_studies ? 'translate-x-5' : 'translate-x-0')} />
          </button>
        </div>
        {saved && <p className="text-[12px] text-teal-deep mt-2 font-body inline-flex items-center gap-1"><Check size={12} /> Guardado</p>}
        {error && <p className="text-[12px] text-coral mt-2 font-body">{error}</p>}
      </div>

      {/* Recomendaciones (todas, para roles administrativos) */}
      <MemberRecommendations memberId={memberId} />
    </div>
  )
}
