'use client'

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
  const hasLeader = !!committee.leader.member_id

  return (
    <div className="ph">
      <button
        className="btn btn-ghost btn-sm mb-[10px]"
        onClick={onBack}
      >
        ← Volver a servidores
      </button>
      <div className="ph-row">
        <div>
          <div className="ptitle">{committeeOverride.name ?? committee.name}</div>
          <div className="psub">
            {committeeOverride.area ?? committee.area} · {activeCount} servidor{activeCount !== 1 ? 'es' : ''} activo{activeCount !== 1 ? 's' : ''}
          </div>
          {/* Encargado del comité (areas.leader_id) */}
          <div className="mt-3">
            <p className="text-[11px] uppercase tracking-widest text-navy-light/70 font-display mb-1.5">
              Encargado
            </p>
            {hasLeader ? (
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-navy flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold text-white font-display">
                    {committee.leader.initials}
                  </span>
                </div>
                <span className="text-[13px] text-[rgba(41,54,92,0.7)] font-body">
                  {committee.leader.name}
                </span>
                <Link
                  href={`/miembros/${committee.leader.member_id}`}
                  className="text-[12px] text-coral hover:underline font-body"
                >
                  Ver perfil
                </Link>
              </div>
            ) : (
              <span className="text-[12px] text-navy-light/70 italic font-body">
                Sin encargado asignado
              </span>
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
