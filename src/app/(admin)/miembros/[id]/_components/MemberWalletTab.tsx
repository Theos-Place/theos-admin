import { Smartphone, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Member } from '@/types/member'


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
            className="text-lg text-white font-display font-extrabold"
          >
            Theos
          </span>
          <span
            className="text-lg text-coral font-display font-extrabold"
          >
            PLACE
          </span>
        </div>

        {/* Identificador del carné: cédula si la tiene */}
        <p
          className="text-xs text-white/70 mb-1 font-mono"
        >
          {member.cedula ? `#${member.cedula}` : ''}
        </p>

        {/* Name */}
        <p
          className="text-white text-base leading-tight font-display font-extrabold"
        >
          {member.first_name}
        </p>
        <p
          className="text-white/60 text-sm mb-5 font-display font-extrabold"
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
            'rounded-full px-2.5 py-0.5 text-xs font-body',
            member.wallet_pass_status === 'active'
              ? 'bg-teal/20 text-teal'
              : 'bg-white/10 text-white/70'
          )}
        >
          {member.wallet_pass_status === 'active' ? 'Pase activo' : 'No generado'}
        </span>
      </div>

      {/* Status badge below */}
      <p
        className={cn(
          'text-xs font-body',
          member.wallet_pass_status === 'active' ? 'text-teal-deep' : 'text-navy-light/60'
        )}
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
            className="w-full rounded-full bg-coral py-2.5 text-sm text-white transition-all hover:bg-coral-deep active:scale-95 shadow-[var(--shadow-pulse)] font-body"
          >
            Generar pase
          </button>
        )}
        <button
          type="button"
          className="flex items-center justify-center gap-2 w-full rounded-xl border border-[var(--outline-variant)] py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
        >
          <Smartphone size={14} strokeWidth={1.75} />
          Enviar a Apple Wallet
        </button>
        <button
          type="button"
          className="flex items-center justify-center gap-2 w-full rounded-xl border border-[var(--outline-variant)] py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
        >
          <Smartphone size={14} strokeWidth={1.75} />
          Enviar a Google Wallet
        </button>
        <button
          type="button"
          className="flex items-center justify-center gap-2 w-full rounded-xl border border-[var(--outline-variant)] py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
        >
          <MessageCircle size={14} strokeWidth={1.75} />
          Reenviar por WhatsApp
        </button>
      </div>
    </div>
  )
}
