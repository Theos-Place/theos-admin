import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { getAuthContext } from '@/lib/auth/guard'

export const metadata: Metadata = {
  title: 'Centro de ayuda · Theos Place',
  description: 'Guías y tutoriales del sistema de Theos Place.',
}

// El centro de ayuda es RUTA PÚBLICA (ver PUBLIC_PREFIXES en src/proxy.ts): los
// correos de invitación linkean acá y el tutorial de "crear mi contraseña" se lee
// ANTES de poder entrar. Con sesión, el índice suma lo que el rol permita.
export default async function AyudaLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext()

  return (
    <div className="min-h-screen bg-surface-low">
      <header className="bg-navy">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-4">
          <Link href={ctx ? '/dashboard' : '/'} className="flex items-center gap-2.5">
            <Image
              src="/logo-theos-white.png"
              alt="Theos Place"
              width={104}
              height={28}
              className="h-6 w-auto"
              priority
            />
          </Link>
          <Link
            href={ctx ? '/dashboard' : '/login'}
            className="rounded-full border border-white/20 px-3.5 py-1.5 text-[12px] text-white/90 hover:bg-white/10 transition-colors font-body"
          >
            {ctx ? 'Ir al sistema' : 'Iniciar sesión'}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-6 pb-16">{children}</main>

      <footer className="mx-auto max-w-3xl px-5 pb-10">
        <p className="text-[12px] text-navy-light/70 font-body">
          ¿No encontrás lo que buscás? Escribinos a{' '}
          <a href="mailto:soporte@theosplace.org" className="text-teal-deep underline">
            soporte@theosplace.org
          </a>
          .
        </p>
      </footer>
    </div>
  )
}
