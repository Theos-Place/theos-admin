'use client'

import { Copy, Edit, Trash2, Send, Lock, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChannelBadge } from './ChannelBadge'
import { categoryLabel, categoryColor } from '@/lib/communications/categories'
import { templateSnippet } from '@/lib/communications/template-snippet'
import type { MessageTemplate } from '@/data/communication-utils'

interface Props {
  template: MessageTemplate
  onUse?: (t: MessageTemplate) => void
  onPreview?: (t: MessageTemplate) => void
  onEdit?: (t: MessageTemplate) => void
  onDuplicate?: (t: MessageTemplate) => void
  onDelete?: (t: MessageTemplate) => void
}

export function TemplateCard({ template, onUse, onPreview, onEdit, onDuplicate, onDelete }: Props) {
  // El cuerpo de correo es HTML: mostrar markup crudo no dice nada de qué
  // plantilla es. Se resume a texto legible (y el ojo abre el correo completo).
  const snippet = templateSnippet(template.body)
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3 bg-surface-card shadow-[var(--shadow-md)]"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-navy leading-snug font-body">
          {template.name}
        </p>
        <ChannelBadge channel={template.channel} size="sm" />
      </div>

      {/* Category + marca de sistema */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold font-display', categoryColor(template.category))}>
          {categoryLabel(template.category)}
        </span>
        {template.is_system && (
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-soft/30 text-teal-deep px-2.5 py-0.5 text-[11px] font-semibold font-display">
            <Lock size={9} /> Plantilla del sistema
          </span>
        )}
      </div>

      {/* Body preview */}
      <p className="text-[12px] text-navy-light/70 leading-relaxed line-clamp-2 font-body">
        {snippet || <span className="italic">Sin texto visible — abrí la vista previa</span>}
      </p>

      {/* Variables */}
      {template.variables.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {template.variables.map(v => (
            <span
              key={v}
              className="rounded-full bg-navy/5 px-2 py-0.5 text-[11px] text-navy-light/70 font-mono"
            >
              {v}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-[var(--outline-variant)]">
        <span className="text-[12px] text-navy-light/70 font-body">
          Usado {template.used_count} veces
        </span>
        <div className="flex items-center gap-1">
          {onPreview && (
            <button
              type="button"
              onClick={() => onPreview(template)}
              title="Ver cómo se ve"
              aria-label={`Ver cómo se ve la plantilla ${template.name}`}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--outline-variant)] px-2.5 py-1 text-[12px] text-navy-light hover:bg-surface-low transition-colors font-body"
            >
              <Eye size={11} />
              Ver
            </button>
          )}
          {onUse && (
            <button
              type="button"
              onClick={() => onUse(template)}
              className="inline-flex items-center gap-1 rounded-lg bg-coral px-2.5 py-1 text-[12px] text-white hover:bg-coral-deep transition-colors font-body"
            >
              <Send size={10} />
              Usar
            </button>
          )}
          {onEdit && (
            <button type="button" onClick={() => onEdit(template)} title="Editar" aria-label="Editar" className="rounded-lg p-1.5 text-navy-light/70 hover:text-navy hover:bg-surface-low transition-colors">
              <Edit size={13} />
            </button>
          )}
          {onDuplicate && (
            <button type="button" onClick={() => onDuplicate(template)} title="Duplicar plantilla" aria-label="Duplicar plantilla" className="rounded-lg p-1.5 text-navy-light/70 hover:text-navy hover:bg-surface-low transition-colors">
              <Copy size={13} />
            </button>
          )}
          {/* Las plantillas del sistema NO se borran. */}
          {onDelete && !template.is_system && (
            <button type="button" onClick={() => onDelete(template)} className="rounded-lg p-1.5 text-navy-light/70 hover:text-coral hover:bg-coral/5 transition-colors">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
