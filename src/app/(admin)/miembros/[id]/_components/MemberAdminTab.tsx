'use client'

import { useState, useEffect, useCallback } from 'react'
import { HeartHandshake, ShieldCheck, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'

const REC_LABEL: Record<string, string> = { oracion: 'Oración', servicio: 'Servicio', dirigente: 'Dirigente' }
const REC_BADGE: Record<string, string> = {
  oracion: 'bg-navy/10 text-navy',
  servicio: 'bg-teal-soft/30 text-teal-deep',
  dirigente: 'bg-coral-soft/20 text-coral',
}

type Recommendation = {
  id: string
  recommended_for: 'oracion' | 'servicio' | 'dirigente'
  justification: string | null
  recommended_by_name: string | null
  group_name: string | null
  created_at: string
}

type AdminData = {
  approved_to_lead_studies: boolean
  approved_at: string | null
  approved_by_name: string | null
  can_edit: boolean
}

/** Tab "Administrativo": SOLO roles administrativos (el miembro nunca lo ve, ni
 *  el tab ni los datos). Consolida las recomendaciones de cierres de estudio
 *  (antes en Participación) + el control "Aprobado para dar estudios". */
export function MemberAdminTab({ memberId }: { memberId: string }) {
  const [recs, setRecs] = useState<Recommendation[] | null>(null)
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

  useEffect(() => {
    let alive = true
    fetch(`/api/members/${memberId}/recommendations`)
      .then(r => (r.ok ? r.json() : []))
      .then(d => { if (alive && Array.isArray(d)) setRecs(d) })
      .catch(() => { if (alive) setRecs([]) })
    loadAdmin()
    return () => { alive = false }
  }, [memberId, loadAdmin])

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

  // Recomendaciones para dar estudios (dirigente) primero; luego el resto.
  const dirigenteRecs = (recs ?? []).filter(r => r.recommended_for === 'dirigente')
  const otherRecs = (recs ?? []).filter(r => r.recommended_for !== 'dirigente')

  return (
    <div className="space-y-4">
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

      {/* Recomendaciones (consolidadas, antes en Participación) */}
      <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-2 mb-3">
          <HeartHandshake size={15} className="text-coral" />
          <p className="text-[10px] uppercase tracking-wider text-navy-light/70 font-display">Recomendaciones de cierres de estudio</p>
        </div>
        {recs === null ? (
          <div className="h-16 rounded-xl bg-surface-low animate-pulse" />
        ) : recs.length === 0 ? (
          <p className="text-[13px] text-navy-light/60 font-body">Sin recomendaciones registradas.</p>
        ) : (
          <ul className="space-y-2.5">
            {[...dirigenteRecs, ...otherRecs].map(r => (
              <li key={r.id} className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-body', REC_BADGE[r.recommended_for])}>
                    {REC_LABEL[r.recommended_for]}
                  </span>
                  <span className="text-[11px] text-navy-light/60 font-body">
                    {r.recommended_by_name ? `por ${r.recommended_by_name}` : 'recomendación del cierre'}
                    {r.group_name ? ` · ${r.group_name}` : ''} · {formatDate(r.created_at)}
                  </span>
                </div>
                {r.justification && <p className="text-[13px] text-navy-light/70 font-body">{r.justification}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
