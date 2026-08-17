'use client'

import { useState, useEffect } from 'react'
import { HeartHandshake } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { formatDate } from '@/lib/format'

/** El nombre de quien hizo la recomendación abre su perfil. Sin id (dato viejo
 *  sin `recommended_by`) queda como texto. */
export function PersonaLink({ id, nombre }: { id: string | null; nombre: string }) {
  if (!id) return <strong className="text-navy-light/80">{nombre}</strong>
  return (
    <Link href={`/miembros/${id}`} className="font-semibold text-teal-deep hover:underline">
      {nombre}
    </Link>
  )
}

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
  recommended_by: string | null
  recommended_by_name: string | null
  group_name: string | null
  created_at: string
}

/** Lista de recomendaciones de cierres de estudio. El backend decide QUÉ devuelve
 *  según el rol (admins: todas; dirigente: solo de sus grupos; resto: vacío).
 *  hideWhenEmpty=true → no pinta nada si no hay (caso dirigente sin recs visibles). */
export function MemberRecommendations({ memberId, hideWhenEmpty = false }: { memberId: string; hideWhenEmpty?: boolean }) {
  const [recs, setRecs] = useState<Recommendation[] | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`/api/members/${memberId}/recommendations`)
      .then(r => (r.ok ? r.json() : []))
      .then(d => { if (alive && Array.isArray(d)) setRecs(d) })
      .catch(() => { if (alive) setRecs([]) })
    return () => { alive = false }
  }, [memberId])

  if (recs === null && hideWhenEmpty) return null
  if (recs !== null && recs.length === 0 && hideWhenEmpty) return null

  // Recomendaciones para dar estudios (dirigente) primero.
  const ordered = recs ? [...recs.filter(r => r.recommended_for === 'dirigente'), ...recs.filter(r => r.recommended_for !== 'dirigente')] : []

  return (
    <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]">
      <div className="flex items-center gap-2 mb-3">
        <HeartHandshake size={15} className="text-coral" />
        <p className="text-[11px] uppercase tracking-wider text-navy-light/70 font-display">Recomendado para oración, servicio o dar estudios</p>
      </div>
      {recs === null ? (
        <div className="h-16 rounded-xl bg-surface-low animate-pulse" />
      ) : recs.length === 0 ? (
        <p className="text-[13px] text-navy-light/70 font-body">
          Nadie lo ha recomendado para oración, servicio ni para dar estudios al cerrar un grupo.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {ordered.map(r => (
            <li key={r.id} className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-body', REC_BADGE[r.recommended_for])}>
                  {REC_LABEL[r.recommended_for]}
                </span>
                <span className="text-[12px] text-navy-light/70 font-body">
                  {r.recommended_by_name
                    ? <>la hizo <PersonaLink id={r.recommended_by} nombre={r.recommended_by_name} /></>
                    : 'sin registro de quién la hizo'}
                  {r.group_name ? ` · al cerrar ${r.group_name}` : ''} · {formatDate(r.created_at)}
                </span>
              </div>
              {r.justification && <p className="text-[13px] text-navy-light/70 font-body">{r.justification}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
