'use client'

import Link from 'next/link'
import { Lock, Home } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { landsOnProfile } from '@/lib/auth/home-route'

/** Pantalla de acceso denegado para módulos fuera de los permisos del rol.
 *
 *  2026-08-06: dejó de ser un callejón sin salida. Con el ?redirect= del login,
 *  ahora es fácil llegar acá desde un deep link —te mandan un link, entrás, y
 *  resulta que ese módulo no es para tu rol—, así que la pantalla tiene que
 *  ofrecer la salida en vez de dejarte mirando un candado. */
export function AccessDenied() {
  const { user } = useAuth()
  // Su página por defecto: el perfil para quien no tiene dashboard.
  const inicio = landsOnProfile(user?.roles ?? []) && user?.member_id
    ? `/miembros/${user.member_id}`
    : '/dashboard'

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy/6 mb-4">
        <Lock size={22} className="text-navy-light/80" />
      </div>
      <p className="text-base font-semibold text-navy font-display mb-1">Acceso restringido</p>
      <p className="text-sm text-navy-light/80 font-body max-w-sm">
        Este contenido no está disponible para tu rol. Si llegaste por un enlace que
        te compartieron y creés que sí te corresponde, contactá a un administrador.
      </p>
      <Link
        href={inicio}
        className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-sm text-white hover:bg-navy/80 transition-colors font-body"
      >
        <Home size={14} /> Ir a mi inicio
      </Link>
    </div>
  )
}
