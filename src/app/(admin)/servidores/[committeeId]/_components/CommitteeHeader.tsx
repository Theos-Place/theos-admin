'use client'

import Link from 'next/link'
import { Plus, Pencil } from 'lucide-react'
import { type CommitteeData } from '@/data/mock-servers'

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
