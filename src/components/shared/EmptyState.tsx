import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

type EmptyStateProps = {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

/** Estado vacío estándar del sistema (listas sin resultados). */
export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center px-4 py-14', className)}>
      <Icon size={28} strokeWidth={1.75} className="text-navy-light/80 mb-3" />
      <p className="text-sm font-semibold text-navy-light/80 font-body">{title}</p>
      {description && <p className="text-[13px] text-navy-light/80 mt-1 font-body max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
