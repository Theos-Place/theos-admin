'use client'

import { Copy, Edit, Trash2, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChannelBadge } from './ChannelBadge'
import type { MessageTemplate } from '@/data/mock-communications'

const CATEGORY_LABELS: Record<MessageTemplate['category'], string> = {
  bienvenida:  'Bienvenida',
  recordatorio:'Recordatorio',
  inscripcion: 'Inscripción',
  cancelacion: 'Cancelación',
  general:     'General',
}

const CATEGORY_COLORS: Record<MessageTemplate['category'], string> = {
  bienvenida:  'bg-teal-soft/30 text-teal-deep',
  recordatorio:'bg-amber-50 text-amber-700',
  inscripcion: 'bg-blue-50 text-blue-700',
  cancelacion: 'bg-coral/10 text-coral',
  general:     'bg-navy/10 text-navy-light',
}

interface Props {
  template: MessageTemplate
  onUse?: (t: MessageTemplate) => void
  onEdit?: (t: MessageTemplate) => void
  onDuplicate?: (t: MessageTemplate) => void
  onDelete?: (t: MessageTemplate) => void
}

export function TemplateCard({ template, onUse, onEdit, onDuplicate, onDelete }: Props) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-navy leading-snug" style={{ fontFamily: 'var(--font-body)' }}>
          {template.name}
        </p>
        <ChannelBadge channel={template.channel} size="sm" />
      </div>

      {/* Category */}
      <span
        className={cn('self-start rounded-full px-2.5 py-0.5 text-[10px] font-semibold', CATEGORY_COLORS[template.category])}
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {CATEGORY_LABELS[template.category]}
      </span>

      {/* Body preview */}
      <p
        className="text-[12px] text-navy-light/60 leading-relaxed line-clamp-2"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        {template.body.replace(/\*/g, '').replace(/_/g, '')}
      </p>

      {/* Variables */}
      {template.variables.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {template.variables.map(v => (
            <span
              key={v}
              className="rounded-full bg-navy/5 px-2 py-0.5 text-[10px] text-navy-light/60"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {v}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: 'var(--outline-variant)' }}>
        <span className="text-[11px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
          Usado {template.used_count} veces
        </span>
        <div className="flex items-center gap-1">
          {onUse && (
            <button
              type="button"
              onClick={() => onUse(template)}
              className="inline-flex items-center gap-1 rounded-lg bg-coral px-2.5 py-1 text-[11px] text-white hover:bg-coral-deep transition-colors"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <Send size={10} />
              Usar
            </button>
          )}
          {onEdit && (
            <button type="button" onClick={() => onEdit(template)} className="rounded-lg p-1.5 text-navy-light/50 hover:text-navy hover:bg-surface-low transition-colors">
              <Edit size={13} />
            </button>
          )}
          {onDuplicate && (
            <button type="button" onClick={() => onDuplicate(template)} className="rounded-lg p-1.5 text-navy-light/50 hover:text-navy hover:bg-surface-low transition-colors">
              <Copy size={13} />
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={() => onDelete(template)} className="rounded-lg p-1.5 text-navy-light/50 hover:text-coral hover:bg-coral/5 transition-colors">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
