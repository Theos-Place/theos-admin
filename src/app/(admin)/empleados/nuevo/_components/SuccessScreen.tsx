import Link from 'next/link'
import { Check } from 'lucide-react'
import { type Member } from '@/data/mock-members'

interface SuccessScreenProps {
  selected: Member | null
}

export function SuccessScreen({ selected }: SuccessScreenProps) {
  return (
    <div className="flex items-center justify-center min-h-60">
      <div className="text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-teal-soft/30 flex items-center justify-center mx-auto">
          <Check size={28} className="text-teal-deep" />
        </div>
        <p
          className="text-xl font-bold text-navy"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Contrato formalizado
        </p>
        <p
          className="text-sm text-navy-light/60"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {selected?.first_name} {selected?.last_name} fue agregado como empleado.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/empleados"
            className="rounded-full border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            Ver empleados
          </Link>
          <Link
            href="/empleados/nuevo"
            className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Contratar otro
          </Link>
        </div>
      </div>
    </div>
  )
}
