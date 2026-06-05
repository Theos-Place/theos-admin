'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Pencil } from 'lucide-react'
import { type CommitteeData } from '@/types/server'

type Props = {
  committee: CommitteeData
  committeeOverride: Partial<CommitteeData>
  activeCount: number
  onEditClick: () => void
  onAddServerClick: () => void
  onBack: () => void
}

export function CommitteeHeader({
  committee,
  committeeOverride,
  activeCount,
  onEditClick,
  onAddServerClick,
  onBack,
}: Props) {
  const [expanded, setExpanded] = useState(false)

  // Encargados: servidores activos cuyo puesto contiene "encargado".
  const encargados = committee.members.filter(
    m => m.status === 'active' && m.position.toLowerCase().includes('encargado'),
  )
  const shown = expanded ? encargados : encargados.slice(0, 3)
  const extra = encargados.length - shown.length

  return (
    <div className="ph">
      <button
        className="btn btn-ghost btn-sm"
        onClick={onBack}
        style={{ marginBottom: 10 }}
      >
        ← Volver a servidores
      </button>
      <div className="ph-row">
        <div>
          <div className="ptitle">{committeeOverride.name ?? committee.name}</div>
          <div className="psub">
            {committeeOverride.area ?? committee.area} · {activeCount} servidor{activeCount !== 1 ? 'es' : ''} activo{activeCount !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <div className="h-7 w-7 rounded-full bg-navy flex items-center justify-center">
              <span className="text-[10px] font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                {committee.leader.initials}
              </span>
            </div>
            <span style={{ fontSize: 13, color: 'rgba(41,54,92,0.7)', fontFamily: 'var(--font-body)' }}>
              {committee.leader.name}
            </span>
            <Link
              href={`/miembros/${committee.leader.member_id}`}
              className="text-[11px] text-coral hover:underline"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Ver perfil
            </Link>
          </div>

          {/* Encargados del comité */}
          <div style={{ marginTop: 12 }}>
            <p className="text-[10px] uppercase tracking-widest text-navy-light/40" style={{ fontFamily: 'var(--font-display)', marginBottom: 6 }}>
              Encargados
            </p>
            {encargados.length === 0 ? (
              <span className="text-[12px] text-navy-light/40 italic" style={{ fontFamily: 'var(--font-body)' }}>
                Sin encargado asignado
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {shown.map(e => (
                  <Link
                    key={`${e.member_id}-${e.position}`}
                    href={`/miembros/${e.member_id}`}
                    className="group flex items-center gap-2 rounded-2xl border px-2.5 py-1.5 transition-colors hover:bg-surface-low"
                    style={{ borderColor: 'var(--outline-variant)' }}
                    title={`Ver perfil de ${e.name}`}
                  >
                    <div className="h-7 w-7 rounded-full bg-navy flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                        {e.initials}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-navy leading-tight group-hover:text-coral transition-colors" style={{ fontFamily: 'var(--font-body)' }}>
                        {e.name}
                      </p>
                      <p className="text-[11px] text-navy-light/50 leading-tight" style={{ fontFamily: 'var(--font-body)' }}>
                        {e.position}
                      </p>
                    </div>
                  </Link>
                ))}
                {!expanded && extra > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    className="rounded-full bg-surface-low px-3 py-1.5 text-[12px] text-navy-light/70 hover:text-navy transition-colors"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    +{extra} más
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-ghost btn-sm" onClick={onEditClick}>
            <Pencil size={13} /> Editar comité
          </button>
          <button className="btn btn-primary btn-sm" onClick={onAddServerClick}>
            <Plus size={13} /> Añadir servidor
          </button>
        </div>
      </div>
    </div>
  )
}
