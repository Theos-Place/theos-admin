import Link from 'next/link'
import { SearchX } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6">
      <div className="flex w-full max-w-md flex-col items-center rounded-2xl border border-[rgba(22,20,64,0.08)] bg-surface-card p-8 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(22,20,64,0.06)]">
          <SearchX size={22} className="text-navy-light" />
        </div>
        <p className="mb-1 font-display text-base font-semibold text-navy">
          Página no encontrada
        </p>
        <p className="mb-5 max-w-xs font-body text-sm text-navy-light/60">
          La página que buscás no existe o fue movida.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-full bg-coral px-4 py-2 font-body text-sm font-medium text-white transition-colors"
        >
          Ir al dashboard
        </Link>
      </div>
    </div>
  )
}
