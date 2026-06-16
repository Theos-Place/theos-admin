import { cn } from '@/lib/utils'
import { CheckCircle2, XCircle, Users, TrendingUp } from 'lucide-react'
import type { CommunicationMessage } from '@/data/communication-utils'

interface Props {
  message: CommunicationMessage
}

export function DeliveryStats({ message }: Props) {
  const { stats } = message
  const deliveryRate = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0
  const failRate = stats.total > 0 ? Math.round((stats.failed / stats.total) * 100) : 0

  const cards = [
    {
      label: 'Total destinatarios',
      value: stats.total,
      icon: Users,
      color: 'text-navy',
      bg: 'bg-navy/5',
    },
    {
      label: 'Entregados',
      value: `${stats.delivered} (${deliveryRate}%)`,
      icon: CheckCircle2,
      color: 'text-teal-deep',
      bg: 'bg-teal-soft/20',
    },
    {
      label: 'Fallidos',
      value: stats.failed,
      icon: XCircle,
      color: stats.failed > 0 ? 'text-coral' : 'text-navy-light/60',
      bg: stats.failed > 0 ? 'bg-coral/10' : 'bg-navy/5',
    },
    {
      label: 'Tasa de entrega',
      value: `${deliveryRate}%`,
      icon: TrendingUp,
      color: deliveryRate >= 90 ? 'text-teal-deep' : deliveryRate >= 70 ? 'text-amber-600' : 'text-coral',
      bg: 'bg-navy/5',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-2xl p-4 bg-surface-card shadow-[var(--shadow-md)]">
            <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center mb-3', bg)}>
              <Icon size={16} className={color} />
            </div>
            <p className="text-[10px] uppercase tracking-widests text-navy-light/60 mb-1 font-display">
              {label}
            </p>
            <p className={cn('text-2xl font-extrabold tabular-nums font-display', color)}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Progress bars */}
      {stats.total > 0 && (
        <div className="rounded-2xl p-5 space-y-3 bg-surface-card shadow-[var(--shadow-md)]">
          <p className="text-[10px] uppercase tracking-widests text-navy-light/60 font-display">
            Distribución de entrega
          </p>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-navy-light/60 w-20 shrink-0 font-body">Entregados</span>
              <div className="flex-1 h-2 rounded-full bg-navy/10">
                <div className="h-2 rounded-full bg-teal-deep transition-all" style={{ width: `${deliveryRate}%` }} />
              </div>
              <span className="text-[11px] font-mono text-navy tabular-nums w-10 text-right">
                {deliveryRate}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-navy-light/60 w-20 shrink-0 font-body">Fallidos</span>
              <div className="flex-1 h-2 rounded-full bg-navy/10">
                <div className="h-2 rounded-full bg-coral transition-all" style={{ width: `${failRate}%` }} />
              </div>
              <span className="text-[11px] font-mono text-navy tabular-nums w-10 text-right">
                {failRate}%
              </span>
            </div>
            {message.channel === 'both' && (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-navy-light/60 w-20 shrink-0 font-body">WhatsApp</span>
                  <div className="flex-1 h-2 rounded-full bg-navy/10">
                    <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${stats.total > 0 ? Math.round(stats.whatsapp_sent / stats.total * 100) : 0}%` }} />
                  </div>
                  <span className="text-[11px] font-mono text-navy tabular-nums w-10 text-right">
                    {stats.whatsapp_sent}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-navy-light/60 w-20 shrink-0 font-body">Email</span>
                  <div className="flex-1 h-2 rounded-full bg-navy/10">
                    <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${stats.total > 0 ? Math.round(stats.email_sent / stats.total * 100) : 0}%` }} />
                  </div>
                  <span className="text-[11px] font-mono text-navy tabular-nums w-10 text-right">
                    {stats.email_sent}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
