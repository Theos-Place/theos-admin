'use client'

import { useState } from 'react'
import Link from 'next/link'
import { UserPlus, UserMinus, ArrowRight } from 'lucide-react'
import type { Member, FamilyEntry } from '@/types/member'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/components/shared/Toast'
import { FamilyMemberModal, type FamilyDraft } from '@/components/members/FamilyMemberModal'
import { DeleteConfirmModal } from '@/components/shared/DeleteConfirmModal'

type Props = {
  member: Member
  /** Refresca el perfil tras vincular/desvincular (recarga family_members). */
  onChanged?: () => void
}

export function MemberFamilyTab({ member, onChanged }: Props) {
  const { can } = usePermissions()
  const toast = useToast()
  const canEdit = can('miembros', 'edit')

  const [showAdd, setShowAdd] = useState(false)
  const [unlinkTarget, setUnlinkTarget] = useState<FamilyEntry | null>(null)
  const [busy, setBusy] = useState(false)

  // Vincular: draft del modal → POST. 'new' crea el miembro antes de vincular.
  async function handleAdd(draft: FamilyDraft) {
    setBusy(true)
    try {
      let linkId: string
      let relation: string
      if (draft.kind === 'linked') {
        linkId = draft.member_id
        relation = draft.relation
      } else {
        const cRes = await fetch('/api/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            first_name: draft.first_name, last_name: draft.last_name, cedula: draft.cedula,
            birth_date: draft.birth_date, phone: draft.phone, email: draft.email, is_active: true,
          }),
        })
        const cData = await cRes.json().catch(() => null)
        if (!cRes.ok) throw new Error(cData?.code === 'duplicate'
          ? `Ya existe un miembro con esa cédula o correo.`
          : (cData?.error ?? 'No se pudo crear el integrante.'))
        linkId = cData.id
        relation = draft.relation
      }
      const res = await fetch(`/api/members/${member.id}/family`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: linkId, relation }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'No se pudo vincular al familiar.')
      setShowAdd(false)
      toast('Familiar vinculado.', 'success')
      onChanged?.()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo vincular al familiar.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleUnlink() {
    if (!unlinkTarget) return
    setBusy(true)
    try {
      const res = await fetch(`/api/members/${member.id}/family`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: unlinkTarget.id }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'No se pudo desvincular.')
      const name = unlinkTarget.name
      setUnlinkTarget(null)
      toast(`${name} fue desvinculado/a de la familia.`, 'success')
      onChanged?.()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo desvincular.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const existingIds = member.family_members.map(f => f.id).filter(Boolean)

  return (
    <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h3 className="text-sm font-medium text-navy font-display font-extrabold">
          Núcleo familiar
        </h3>
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--outline-variant)] px-3.5 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors font-body self-start sm:self-auto"
          >
            <UserPlus size={14} strokeWidth={1.75} />
            Vincular familiar
          </button>
        )}
      </div>

      {member.family_members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <UserPlus size={32} className="text-navy-light/80 mb-3" strokeWidth={1.25} />
          <p className="text-sm text-navy-light/80 font-body">
            No hay familiares vinculados
          </p>
          {canEdit && (
            <p className="text-xs text-navy-light/80 mt-1 font-body">
              Usá el botón de arriba para vincular un familiar.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {member.family_members.map((fm) => {
            const hasProfile = Boolean(fm.id)
            const avatar = (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-white text-xs font-display font-extrabold">
                {fm.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
              </div>
            )
            const info = (
              <div className="flex-1 min-w-0">
                <p className="text-sm text-navy font-body">{fm.name}</p>
                <span className="rounded-full bg-teal-soft/30 px-2 py-0.5 text-[11px] text-teal-deep mt-0.5 inline-block font-body">
                  {fm.relation}
                </span>
              </div>
            )
            return (
              <div key={fm.id} className="flex items-center gap-3 rounded-xl bg-surface-low px-4 py-3">
                {hasProfile ? (
                  <Link href={`/miembros/${fm.id}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                    {avatar}
                    {info}
                    <ArrowRight size={15} className="shrink-0 text-navy-light/80" strokeWidth={1.75} />
                  </Link>
                ) : (
                  <>
                    {avatar}
                    {info}
                  </>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setUnlinkTarget(fm)}
                    aria-label={`Desvincular a ${fm.name}`}
                    title="Desvincular"
                    className="shrink-0 rounded-lg p-2 text-navy-light/50 hover:text-coral hover:bg-coral/10 transition-colors"
                  >
                    <UserMinus size={15} strokeWidth={1.75} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showAdd && (
        <FamilyMemberModal
          defaultLastName={member.last_name}
          existingIds={existingIds}
          onAdd={handleAdd}
          onClose={() => { if (!busy) setShowAdd(false) }}
        />
      )}

      <DeleteConfirmModal
        open={!!unlinkTarget}
        title="Desvincular familiar"
        description={`Se desvinculará a ${unlinkTarget?.name ?? ''} de esta familia. El vínculo desaparece en ambos perfiles. Esta acción no borra a la persona del sistema.`}
        keyword="desvincular"
        confirmLabel="Desvincular"
        loading={busy}
        onConfirm={handleUnlink}
        onCancel={() => { if (!busy) setUnlinkTarget(null) }}
      />
    </div>
  )
}
