'use client'

import { FileText, CreditCard, ShieldCheck, File, ExternalLink, Trash2 } from 'lucide-react'
import type { EmployeeDocument, DocumentType } from '@/types/employee'
import { cn } from '@/lib/utils'

const ICON_MAP: Record<DocumentType, React.ComponentType<{ size?: number; className?: string }>> = {
  contrato:       FileText,
  identificacion: CreditCard,
  seguro_social:  ShieldCheck,
  otro:           File,
}

const TYPE_LABELS: Record<DocumentType, string> = {
  contrato:       'Contrato',
  identificacion: 'Identificación',
  seguro_social:  'Seguro social',
  otro:           'Otro',
}

interface DocumentCardProps {
  doc: EmployeeDocument
  onDelete?: (id: string) => void
}

export function DocumentCard({ doc, onDelete }: DocumentCardProps) {
  const Icon = ICON_MAP[doc.type]
  return (
    <div
      className="flex items-center gap-3 rounded-2xl p-4 bg-surface-card shadow-[var(--shadow-md)]"
    >
      <div className="h-10 w-10 rounded-xl bg-navy/10 flex items-center justify-center shrink-0">
        <Icon size={18} className="text-navy" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-navy truncate font-body">
          {doc.name}
        </p>
        <p className="text-[11px] text-navy-light/40 font-body">
          {TYPE_LABELS[doc.type]} · {new Date(doc.uploaded_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <a
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Abrir documento ${doc.name}`}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-navy-light/40 hover:text-navy hover:bg-surface-low transition-colors"
        >
          <ExternalLink size={14} />
        </a>
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(doc.id)}
            aria-label={`Eliminar documento ${doc.name}`}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-navy-light/40 hover:text-coral hover:bg-coral/10 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
