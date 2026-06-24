import { useRef } from 'react'
import { AlertTriangle, Check, Upload, X, FileText, CreditCard, ShieldCheck, File } from 'lucide-react'
import { type MemberHit } from '@/components/shared/MemberCombobox'
import { type ContractType } from '@/types/employee'
import { type PaidPosition } from '@/types/employee'
import { ContractTypeBadge } from '@/components/employees/ContractTypeBadge'
import { cn } from '@/lib/utils'

type DocKey = 'contrato' | 'cedula' | 'ccss'

const REQUIRED_DOCS: { key: DocKey; label: string; icon: React.ElementType }[] = [
  { key: 'contrato', label: 'Contrato firmado',    icon: FileText    },
  { key: 'cedula',   label: 'Cédula de identidad', icon: CreditCard  },
  { key: 'ccss',     label: 'Inscripción CCSS',     icon: ShieldCheck },
]

const OPTIONAL_DOCS: { key: string; label: string; icon: React.ElementType }[] = [
  { key: 'otro', label: 'Otro documento', icon: File },
]

interface StepDocumentsProps {
  selected: MemberHit | null
  selectedPosition: PaidPosition | null
  contractType: ContractType
  salary: string
  startDate: string
  salaryOutOfRange: boolean
  uploadedDocs: Record<string, File>
  onUpload: (key: string, file: File) => void
  onRemoveDoc: (key: string) => void
  canFinish: boolean
}

export function StepDocuments({
  selected,
  selectedPosition,
  contractType,
  salary,
  startDate,
  salaryOutOfRange,
  uploadedDocs,
  onUpload,
  onRemoveDoc,
  canFinish,
}: StepDocumentsProps) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div
        className="rounded-2xl p-5 space-y-3 bg-surface-card shadow-[var(--shadow-md)]"
      >
        <p
          className="text-[11px] tracking-widest uppercase text-navy-light/60 font-display"
        >
          Resumen del contrato
        </p>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-navy flex items-center justify-center shrink-0">
            <span className="text-[11px] font-bold text-white font-display">
              {selected?.first_name[0]}{selected?.last_name[0]}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-navy font-display">
              {selected?.first_name} {selected?.last_name}
            </p>
            <p className="text-[12px] text-navy-light/60 font-body">
              {selected?.email}
            </p>
          </div>
        </div>
        <div
          className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--outline-variant)]"
        >
          {[
            { label: 'Puesto',  value: selectedPosition?.name ?? '—' },
            { label: 'Comité',  value: selectedPosition?.committee_name ?? '—' },
            {
              label: 'Inicio',
              value: startDate
                ? new Date(startDate + 'T00:00:00').toLocaleDateString('es-CR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : '—',
            },
            {
              label: 'Salario',
              value: salary ? `₡${parseFloat(salary).toLocaleString('es-CR')}` : '—',
            },
          ].map(({ label, value }) => (
            <div key={label}>
              <p
                className="text-[10px] uppercase tracking-widest text-navy-light/60 font-display"
              >
                {label}
              </p>
              <p className="text-sm text-navy mt-0.5 font-body">
                {value}
              </p>
            </div>
          ))}
        </div>
        {salaryOutOfRange && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[12px] text-amber-700 font-body">
              Salario fuera del rango aprobado — requiere aprobación adicional.
            </p>
          </div>
        )}
        <div className="flex items-center gap-2 pt-1">
          <ContractTypeBadge type={contractType} size="sm" />
        </div>
      </div>

      {/* Documentos requeridos */}
      <div
        className="rounded-2xl p-5 space-y-3 bg-surface-card shadow-[var(--shadow-md)]"
      >
        <div className="flex items-center justify-between">
          <p
            className="text-[11px] tracking-widest uppercase text-navy-light/60 font-display"
          >
            Documentos requeridos
          </p>
          <span className="text-[11px] text-navy-light/60 font-mono">
            {REQUIRED_DOCS.filter(d => uploadedDocs[d.key]).length}/{REQUIRED_DOCS.length}
          </span>
        </div>
        <div className="space-y-2">
          {REQUIRED_DOCS.map(doc => {
            const DocIcon = doc.icon
            const uploaded = uploadedDocs[doc.key]
            return (
              <div
                key={doc.key}
                className="flex items-center justify-between gap-3 rounded-xl p-3 bg-surface-low"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                      uploaded ? 'bg-teal-soft/30' : 'bg-navy/5'
                    )}
                  >
                    {uploaded ? (
                      <Check size={15} className="text-teal-deep" />
                    ) : (
                      <DocIcon size={15} className="text-navy-light/60" />
                    )}
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-navy font-body">
                      {doc.label}
                    </p>
                    {uploaded && (
                      <p className="text-[11px] text-teal-deep font-mono truncate max-w-[160px]">
                        {uploaded.name}
                      </p>
                    )}
                  </div>
                </div>
                {uploaded ? (
                  <button
                    type="button"
                    onClick={() => onRemoveDoc(doc.key)}
                    className="h-7 w-7 rounded-full hover:bg-coral/10 flex items-center justify-center transition-colors"
                  >
                    <X size={13} className="text-coral" />
                  </button>
                ) : (
                  <>
                    <input
                      ref={el => { fileInputRefs.current[doc.key] = el }}
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) onUpload(doc.key, file)
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRefs.current[doc.key]?.click()}
                      className="flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] px-3 py-1.5 text-[11px] text-navy-light hover:bg-white transition-colors font-body"
                    >
                      <Upload size={12} />
                      Subir
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Documentos opcionales */}
      <div
        className="rounded-2xl p-5 space-y-3 bg-surface-card shadow-[var(--shadow-md)]"
      >
        <p
          className="text-[11px] tracking-widest uppercase text-navy-light/60 font-display"
        >
          Documentos adicionales
        </p>
        {OPTIONAL_DOCS.map(doc => {
          const DocIcon = doc.icon
          const uploaded = uploadedDocs[doc.key]
          return (
            <div
              key={doc.key}
              className="flex items-center justify-between gap-3 rounded-xl p-3 bg-surface-low"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                    uploaded ? 'bg-teal-soft/30' : 'bg-navy/5'
                  )}
                >
                  {uploaded ? (
                    <Check size={15} className="text-teal-deep" />
                  ) : (
                    <DocIcon size={15} className="text-navy-light/60" />
                  )}
                </div>
                <div>
                  <p className="text-[13px] font-medium text-navy font-body">
                    {doc.label}
                  </p>
                  {uploaded && (
                    <p className="text-[11px] text-teal-deep font-mono truncate max-w-[160px]">
                      {uploaded.name}
                    </p>
                  )}
                </div>
              </div>
              {uploaded ? (
                <button
                  type="button"
                  onClick={() => onRemoveDoc(doc.key)}
                  className="h-7 w-7 rounded-full hover:bg-coral/10 flex items-center justify-center transition-colors"
                >
                  <X size={13} className="text-coral" />
                </button>
              ) : (
                <>
                  <input
                    ref={el => { fileInputRefs.current[doc.key] = el }}
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) onUpload(doc.key, file)
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[doc.key]?.click()}
                    className="flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] px-3 py-1.5 text-[11px] text-navy-light hover:bg-white transition-colors font-body"
                  >
                    <Upload size={12} />
                    Subir
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>

      {!canFinish && (
        <p
          className="text-center text-[12px] text-navy-light/60 font-body"
        >
          Subí los 3 documentos requeridos para formalizar el contrato.
        </p>
      )}
    </div>
  )
}
