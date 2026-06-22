import { cn } from '@/lib/utils'

/** Selector del formato del cuerpo del correo: texto plano vs HTML crudo.
 *  Compartido por el editor de plantillas y el compositor de comunicaciones. */
export function FormatToggle({
  value, onChange,
}: {
  value: 'text' | 'html'
  onChange: (v: 'text' | 'html') => void
}) {
  return (
    <div className="inline-flex rounded-full bg-surface-low p-0.5" role="group" aria-label="Formato del cuerpo">
      {([['text', 'Cuerpo'], ['html', 'HTML']] as const).map(([val, label]) => (
        <button
          key={val}
          type="button"
          onClick={() => onChange(val)}
          aria-pressed={value === val}
          className={cn(
            'rounded-full px-3 py-1 text-[11px] font-medium font-body transition-colors',
            value === val ? 'bg-coral text-white' : 'text-navy-light/70 hover:text-navy',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
