import Image from 'next/image'
import type { Metadata } from 'next'
import { safeNextPath } from '@/lib/auth/link-error'

export const metadata: Metadata = {
  title: 'Continuar · Theos Place',
  robots: { index: false, follow: false },
}

// Pantalla intermedia del enlace del correo (2026-08-03).
//
// POR QUÉ EXISTE: el token del correo se consume al ABRIR la URL, y los filtros
// de seguridad del correo — Safe Links de Microsoft 365, entre otros — abren los
// enlaces ANTES que la persona, para revisarlos. Resultado: el token quedaba
// gastado y a la persona le salía "el enlace ya venció" sin haber hecho nada.
// Fue el caso que no se resolvía ni reenviando el correo.
//
// La solución es que el enlace del correo NO consuma nada: cae acá, que es una
// página inofensiva, y el token se canjea solo cuando alguien toca el botón. Los
// filtros no tocan botones.
export default async function ContinuarPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>
}) {
  const sp = await searchParams
  const tokenHash = sp.token_hash ?? ''
  const type = sp.type === 'invite' ? 'invite' : 'recovery'
  const next = safeNextPath(sp.next, type === 'invite' ? '/completar-perfil' : '/recuperar/nueva-contrasena')

  const confirmUrl = `/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${type}&next=${encodeURIComponent(next)}`
  const esInvitacion = type === 'invite'

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-[420px] rounded-3xl bg-surface-card p-7 shadow-[var(--shadow-lg)] text-center">
        <Image
          src="/logo-theos-original.png"
          alt="Theos Place"
          width={120}
          height={32}
          className="mx-auto h-7 w-auto"
          priority
        />

        <h1 className="mt-6 text-xl font-extrabold text-navy font-display tracking-[-0.02em]">
          {esInvitacion ? 'Definí tu contraseña' : 'Cambiá tu contraseña'}
        </h1>
        <p className="mt-2 text-sm text-navy-light/80 font-body leading-relaxed">
          {esInvitacion
            ? 'Tocá el botón para continuar y elegir tu contraseña.'
            : 'Tocá el botón para continuar y elegir tu contraseña nueva.'}
        </p>

        {tokenHash ? (
          <a
            href={confirmUrl}
            className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-coral px-4 py-3.5 text-sm font-semibold text-white hover:bg-coral-deep transition-colors font-body"
          >
            Continuar
          </a>
        ) : (
          <p className="mt-6 text-sm text-coral font-body">
            Este enlace está incompleto. Abrilo directo desde el correo, sin copiarlo y pegarlo.
          </p>
        )}

        <p className="mt-5 text-[13px] text-navy-light/80 font-body leading-relaxed">
          El enlace sirve una sola vez. Si ya definiste tu contraseña, entrá directo desde{' '}
          <a href="/login" className="text-teal-deep underline">la pantalla de inicio</a>.
        </p>
      </div>
    </div>
  )
}
