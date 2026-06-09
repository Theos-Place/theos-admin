import { cn } from '@/lib/utils'
import {
  Mic, Tent, Heart, BookOpen,
  Users, Star, MapPin, Music, Coffee, Zap,
} from 'lucide-react'

// ─── Styling ──────────────────────────────────────────────────────────────────

export const inputCls =
  'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

export const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  mic: Mic, tent: Tent, users: Users, star: Star, 'book-open': BookOpen,
  heart: Heart, 'map-pin': MapPin, music: Music, coffee: Coffee, zap: Zap,
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

export function Toggle({
  checked,
  onToggle,
  label,
}: {
  checked: boolean
  onToggle: () => void
  label: string
}) {
  return (
    <div className="flex items-center gap-3 cursor-pointer" onClick={onToggle}>
      <div
        className={cn(
          'relative h-6 w-11 rounded-full transition-all duration-200 cursor-pointer shrink-0',
          checked ? 'bg-coral' : 'bg-navy-light/20',
        )}
      >
        <div
          className={cn(
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </div>
      <span
        className="text-sm text-navy select-none font-body"
      >
        {label}
      </span>
    </div>
  )
}

export function SummaryRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div
      className="flex items-start justify-between gap-4 py-2.5 border-b last:border-0 border-b-[var(--outline-variant)]"
    >
      <span
        className="text-[11px] tracking-widest uppercase text-navy-light/40 shrink-0 mt-0.5 font-display"
      >
        {label}
      </span>
      <span
        className="text-sm text-navy text-right font-body"
      >
        {value}
      </span>
    </div>
  )
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="text-[11px] tracking-widest uppercase text-navy-light/40 block mb-1 font-display"
    >
      {children}
    </label>
  )
}
