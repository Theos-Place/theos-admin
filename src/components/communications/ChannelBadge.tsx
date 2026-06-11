import { MessageCircle, Mail, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CommunicationChannel } from '@/data/mock-communications'

interface Props {
  channel: CommunicationChannel
  size?: 'sm' | 'md'
}

export function ChannelBadge({ channel, size = 'md' }: Props) {
  const base = size === 'sm'
    ? 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold'
    : 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold'
  const iconSize = size === 'sm' ? 10 : 12

  if (channel === 'interna') {
    return (
      <span className={cn(base, 'bg-coral/10 text-coral-deep', 'font-display')}>
        <Bell size={iconSize} />
        Alerta interna
      </span>
    )
  }
  if (channel === 'whatsapp') {
    return (
      <span className={cn(base, 'bg-emerald-50 text-emerald-700', 'font-display')}>
        <MessageCircle size={iconSize} />
        WhatsApp
      </span>
    )
  }
  if (channel === 'email') {
    return (
      <span className={cn(base, 'bg-blue-50 text-blue-700', 'font-display')}>
        <Mail size={iconSize} />
        Email
      </span>
    )
  }
  return (
    <span className={cn(base, 'bg-violet-50 text-violet-700', 'font-display')}>
      <MessageCircle size={iconSize} />
      <Mail size={iconSize} />
      Ambos
    </span>
  )
}
