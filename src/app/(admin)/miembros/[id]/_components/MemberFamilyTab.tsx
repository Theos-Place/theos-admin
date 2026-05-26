import Link from 'next/link'
import { UserPlus, UserMinus, ArrowRight } from 'lucide-react'
import { mockMembers } from '@/data/mock-members'
import { cn } from '@/lib/utils'

type Member = (typeof mockMembers)[number]

type Props = {
  member: Member
}

export function MemberFamilyTab({ member }: Props) {
  return (
    <div
      className="rounded-2xl bg-surface-card p-5"
      style={{ boxShadow: 'var(--shadow-md)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-sm font-medium text-navy"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
        >
          Núcleo familiar
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            <UserPlus size={14} strokeWidth={1.75} />
            Vincular familiar
          </button>
          <button
            type="button"
            disabled={member.family_members.length === 0}
            className="flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm text-navy-light/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface-low hover:text-coral"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            <UserMinus size={14} strokeWidth={1.75} />
            Desvincular
          </button>
        </div>
      </div>

      {member.family_members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <UserPlus size={32} className="text-navy-light/20 mb-3" strokeWidth={1.25} />
          <p className="text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
            No hay familiares vinculados
          </p>
          <p className="text-xs text-navy-light/30 mt-1" style={{ fontFamily: 'var(--font-body)' }}>
            Usá el botón de arriba para vincular un familiar.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {member.family_members.map((fm) => {
            const hasProfile = mockMembers.some(m => m.id === fm.id)
            const inner = (
              <>
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-white text-xs"
                  style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
                >
                  {fm.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                    {fm.name}
                  </p>
                  <span
                    className="rounded-full bg-teal-soft/30 px-2 py-0.5 text-[10px] text-teal-deep mt-0.5 inline-block"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    {fm.relation}
                  </span>
                </div>
                <ArrowRight size={15} className={cn('shrink-0', hasProfile ? 'text-navy-light/30' : 'text-navy-light/15')} strokeWidth={1.75} />
              </>
            )
            return hasProfile ? (
              <Link
                key={fm.id}
                href={`/miembros/${fm.id}`}
                className="flex items-center gap-3 rounded-xl bg-surface-low px-4 py-3 hover:bg-surface-card cursor-pointer transition-colors"
              >
                {inner}
              </Link>
            ) : (
              <div
                key={fm.id}
                className="flex items-center gap-3 rounded-xl bg-surface-low px-4 py-3"
              >
                {inner}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
