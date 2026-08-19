import { cn } from '@/lib/utils'
import { CheckCircle2, XCircle, Users, TrendingUp, Send, MinusCircle } from 'lucide-react'
import { deliveryCards, deliveryRate, type DeliveryCard } from '@/lib/communications/delivery-stats'
import type { CommunicationMessage } from '@/data/communication-utils'

interface Props {
  message: CommunicationMessage
}

export function DeliveryStats({ message }: Props) {
  const { stats } = message
  // Qué números se muestran sale de una regla pura (lib/communications/delivery-stats.ts):
  // sin confirmaciones del proveedor no se pinta una "tasa de entrega 0%", que se
  // leía como "no llegó ninguno" cuando en realidad todos habían salido.
  const cards = deliveryCards(stats)
  const rate = deliveryRate(stats)
  // Sobre los que SALIERON, igual que deliveryRate: los saltados no son un fallo
  // del envío y no deben inflar ni castigar estos porcentajes.
  const intentados = stats.sent + stats.failed
  const failRate = intentados > 0 ? Math.round((stats.failed / intentados) * 100) : 0
  const sentRate = intentados > 0 ? Math.round((stats.sent / intentados) * 100) : 0

  const TONE: Record<DeliveryCard['tone'], { color: string; bg: string }> = {
    neutral: { color: 'text-navy', bg: 'bg-navy/5' },
    good:    { color: 'text-teal-deep', bg: 'bg-teal-soft/20' },
    warn:    { color: 'text-amber-600', bg: 'bg-amber-50' },
    bad:     { color: 'text-coral', bg: 'bg-coral/10' },
  }
  const ICON: Record<DeliveryCard['key'], typeof Users> = {
    total: Users, enviados: Send, entregados: CheckCircle2, fallidos: XCircle,
    saltados: MinusCircle, tasa: TrendingUp,
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(card => {
          const tone = TONE[card.tone]
          const Icon = ICON[card.key]
          return (
            <div key={card.key} className="rounded-2xl p-4 bg-surface-card shadow-[var(--shadow-md)]">
              <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center mb-3', tone.bg)}>
                <Icon size={16} className={tone.color} />
              </div>
              <p className="text-[11px] uppercase tracking-widest text-navy-light/80 mb-1 font-display">
                {card.label}
              </p>
              <p className={cn('font-extrabold tabular-nums font-display', tone.color,
                card.value === 'Sin datos' ? 'text-base' : 'text-2xl')}>
                {card.value}
              </p>
              {card.hint && (
                <p className="mt-1 text-[11px] text-navy-light/80 font-body leading-snug">{card.hint}</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Progress bars */}
      {stats.total > 0 && (
        <div className="rounded-2xl p-5 space-y-3 bg-surface-card shadow-[var(--shadow-md)]">
          <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display">
            Distribución de entrega
          </p>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-navy-light/80 w-20 shrink-0 font-body">
                {rate != null ? 'Entregados' : 'Enviados'}
              </span>
              <div className="flex-1 h-2 rounded-full bg-navy/10">
                <div className="h-2 rounded-full bg-teal-deep transition-all" style={{ width: `${rate ?? sentRate}%` }} />
              </div>
              <span className="text-[13px] font-mono text-navy tabular-nums w-10 text-right">
                {rate ?? sentRate}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-navy-light/80 w-20 shrink-0 font-body">Fallidos</span>
              <div className="flex-1 h-2 rounded-full bg-navy/10">
                <div className="h-2 rounded-full bg-coral transition-all" style={{ width: `${failRate}%` }} />
              </div>
              <span className="text-[13px] font-mono text-navy tabular-nums w-10 text-right">
                {failRate}%
              </span>
            </div>
            {message.channel === 'both' && (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-[13px] text-navy-light/80 w-20 shrink-0 font-body">WhatsApp</span>
                  <div className="flex-1 h-2 rounded-full bg-navy/10">
                    <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${stats.total > 0 ? Math.round(stats.whatsapp_sent / stats.total * 100) : 0}%` }} />
                  </div>
                  <span className="text-[13px] font-mono text-navy tabular-nums w-10 text-right">
                    {stats.whatsapp_sent}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[13px] text-navy-light/80 w-20 shrink-0 font-body">Email</span>
                  <div className="flex-1 h-2 rounded-full bg-navy/10">
                    <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${stats.total > 0 ? Math.round(stats.email_sent / stats.total * 100) : 0}%` }} />
                  </div>
                  <span className="text-[13px] font-mono text-navy tabular-nums w-10 text-right">
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
