import { Lock } from 'lucide-react'

/** Pantalla de acceso denegado para módulos fuera de los permisos del rol. */
export function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy/6 mb-4">
        <Lock size={22} className="text-navy-light/60" />
      </div>
      <p className="text-base font-semibold text-navy font-display mb-1">Acceso restringido</p>
      <p className="text-sm text-navy-light/60 font-body max-w-sm">
        Tu rol no tiene acceso a este módulo. Si creés que es un error,
        contactá a un administrador.
      </p>
    </div>
  )
}
