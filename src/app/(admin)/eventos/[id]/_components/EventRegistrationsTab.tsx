import { Download, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MockEvent } from '@/data/mock-events'

type Event = MockEvent

const PAYMENT_BADGE: Record<string, string> = {
  paid:     'bg-teal-soft/30 text-teal-deep',
  pending:  'bg-amber-100 text-amber-700',
  exempted: 'bg-navy/10 text-navy/60',
}
const PAYMENT_LABEL: Record<string, string> = {
  paid: 'Pagado', pending: 'Pendiente', exempted: 'Exento',
}

const AVATAR_COLORS: Record<string, string> = {
  A: 'bg-coral', B: 'bg-teal-deep', C: 'bg-navy', D: 'bg-purple-700', E: 'bg-amber-500',
  F: 'bg-coral', G: 'bg-teal-deep', H: 'bg-navy', I: 'bg-purple-700', J: 'bg-amber-500',
  K: 'bg-coral', L: 'bg-teal-deep', M: 'bg-navy', N: 'bg-purple-700', O: 'bg-amber-500',
  P: 'bg-coral', Q: 'bg-teal-deep', R: 'bg-navy', S: 'bg-purple-700', T: 'bg-amber-500',
  U: 'bg-coral', V: 'bg-teal-deep', W: 'bg-navy', X: 'bg-purple-700', Y: 'bg-amber-500', Z: 'bg-coral',
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charAt(0).toUpperCase()] ?? 'bg-navy'
}

type Props = {
  event: Event
  registrationCount: number
  circumference: number
  onSendMessage: () => void
}

export function EventRegistrationsTab({ event, registrationCount, circumference, onSendMessage }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl p-4 flex flex-col items-center" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
          <svg viewBox="0 0 100 100" className="w-20 h-20">
            <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8" stroke="var(--surface-low)" />
            <circle
              cx="50" cy="50" r="40" fill="none" strokeWidth="8" stroke="#70BDC2"
              strokeDasharray={circumference}
              strokeDashoffset={registrationCount > 0 ? circumference * (1 - registrationCount / event.max_capacity) : circumference}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
            />
            <text x="50" y="54" textAnchor="middle" fontSize="18" fontWeight="bold" fill="#161440" fontFamily="var(--font-display)">
              {Math.round((registrationCount / event.max_capacity) * 100)}%
            </text>
          </svg>
          <p className="text-[11px] text-navy-light/50 mt-1" style={{ fontFamily: 'var(--font-body)' }}>Ocupación</p>
          <p className="text-sm font-medium text-navy" style={{ fontFamily: 'var(--font-display)' }}>
            {registrationCount}/{event.max_capacity}
          </p>
        </div>
        {[
          { label: 'Pagados', value: event.registrations.filter(r => r.payment_status === 'paid').length, color: 'text-teal-deep' },
          { label: 'Pendientes', value: event.registrations.filter(r => r.payment_status === 'pending').length, color: 'text-amber-600' },
          { label: 'Exentos', value: event.registrations.filter(r => r.payment_status === 'exempted').length, color: 'text-navy/60' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl p-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <p className="text-[10px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>{label}</p>
            <p className={cn('mt-2 text-4xl font-extrabold tabular-nums', color)} style={{ fontFamily: 'var(--font-display)' }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
          {registrationCount} inscritos
        </p>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12px] text-navy-light hover:bg-surface-low transition-colors" style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}>
            <Download size={13} /> Exportar
          </button>
          <button
            onClick={onSendMessage}
            className="inline-flex items-center gap-1.5 rounded-full bg-coral px-3.5 py-2 text-[12px] text-white hover:bg-coral-deep transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <Send size={13} /> Enviar recordatorio
          </button>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['Nombre', 'Fecha inscripción', 'Pago', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] tracking-widests uppercase text-navy-light/50" style={{ fontFamily: 'var(--font-display)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {event.registrations.slice(0, 20).map((reg, idx) => (
                <tr key={reg.member_id} className={cn('hover:bg-surface-low transition-colors', idx % 2 === 1 ? 'bg-surface-low/40' : '')}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={cn('h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0', avatarColor(reg.member_name))}>
                        {getInitials(reg.member_name)}
                      </div>
                      <span className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>{reg.member_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
                    {new Date(reg.registered_at).toLocaleDateString('es-CR')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-medium', PAYMENT_BADGE[reg.payment_status])}>
                      {PAYMENT_LABEL[reg.payment_status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="text-[11px] text-navy-light hover:text-coral transition-colors" style={{ fontFamily: 'var(--font-body)' }}>Ver perfil</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {registrationCount > 20 && (
          <div className="px-4 py-3 border-t text-center" style={{ borderColor: 'var(--outline-variant)' }}>
            <p className="text-[12px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
              Mostrando 20 de {registrationCount} inscritos
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
