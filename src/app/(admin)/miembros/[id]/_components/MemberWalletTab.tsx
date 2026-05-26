import { Smartphone, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { mockMembers } from '@/data/mock-members'

type Member = (typeof mockMembers)[number]

function qrCells(id: string): boolean[] {
  const n = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return Array.from({ length: 49 }, (_, i) => ((n + i * 17 + i) % 7) < 4)
}

type Props = {
  member: Member
}

export function MemberWalletTab({ member }: Props) {
  return (
    <div className="flex flex-col items-center gap-5">
      {/* Wallet Card */}
      <div className="bg-navy rounded-2xl p-6 w-full max-w-xs">
        {/* Logo */}
        <div className="flex items-baseline gap-0.5 mb-4">
          <span
            className="text-lg text-white"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
          >
            Theos
          </span>
          <span
            className="text-lg text-coral"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
          >
            PLACE
          </span>
        </div>

        {/* Member ID */}
        <p
          className="text-xs text-white/40 mb-1"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          #{member.id.padStart(6, '0')}
        </p>

        {/* Name */}
        <p
          className="text-white text-base leading-tight"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
        >
          {member.first_name}
        </p>
        <p
          className="text-white/60 text-sm mb-5"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
        >
          {member.last_name}
        </p>

        {/* QR Grid 7×7 */}
        <div className="grid grid-cols-7 gap-0.5 w-fit mb-4">
          {qrCells(member.id).map((filled, i) => (
            <div
              key={i}
              className={cn(
                'h-4 w-4 rounded-[2px]',
                filled ? 'bg-white' : 'bg-navy-ink'
              )}
            />
          ))}
        </div>

        {/* Pass status */}
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs',
            member.wallet_pass_status === 'active'
              ? 'bg-teal/20 text-teal'
              : 'bg-white/10 text-white/40'
          )}
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {member.wallet_pass_status === 'active' ? 'Pase activo' : 'No generado'}
        </span>
      </div>

      {/* Status badge below */}
      <p
        className={cn(
          'text-xs',
          member.wallet_pass_status === 'active' ? 'text-teal-deep' : 'text-navy-light/40'
        )}
        style={{ fontFamily: 'var(--font-body)' }}
      >
        {member.wallet_pass_status === 'active'
          ? 'Pase digital activo y válido'
          : 'El pase aún no ha sido generado'}
      </p>

      {/* Action buttons */}
      <div className="flex flex-col gap-2 w-full max-w-xs">
        {member.wallet_pass_status === 'not_generated' && (
          <button
            type="button"
            className="w-full rounded-full bg-coral py-2.5 text-sm text-white transition-all hover:bg-coral-deep active:scale-95"
            style={{ boxShadow: 'var(--shadow-pulse)', fontFamily: 'var(--font-body)' }}
          >
            Generar pase
          </button>
        )}
        <button
          type="button"
          className="flex items-center justify-center gap-2 w-full rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors"
          style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
        >
          <Smartphone size={14} strokeWidth={1.75} />
          Enviar a Apple Wallet
        </button>
        <button
          type="button"
          className="flex items-center justify-center gap-2 w-full rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors"
          style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
        >
          <Smartphone size={14} strokeWidth={1.75} />
          Enviar a Google Wallet
        </button>
        <button
          type="button"
          className="flex items-center justify-center gap-2 w-full rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors"
          style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
        >
          <MessageCircle size={14} strokeWidth={1.75} />
          Reenviar por WhatsApp
        </button>
      </div>
    </div>
  )
}
