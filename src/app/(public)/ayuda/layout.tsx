import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { getAuthContext } from '@/lib/auth/guard'
import { AppShell } from '@/components/layout/AppShell'
import { PageContainer } from '@/components/layout/PageContainer'

export const metadata: Metadata = {
  title: 'Centro de ayuda · Theos Place',
  description: 'Guías y tutoriales del sistema de Theos Place.',
}

// El centro de ayuda es RUTA PÚBLICA (ver PUBLIC_PREFIXES en src/proxy.ts): los
// correos de invitación linkean acá y el tutorial de "crear mi contraseña" se lee
// ANTES de poder entrar.
//
// CON SESIÓN se pinta dentro del cascarón del sistema — con sidebar y topbar —
// porque la ayuda se consulta en medio de una tarea y perder el menú obliga a
// volver con el botón del navegador. SIN SESIÓN va sola: no hay menú que mostrar.
//
// ANCHO (2026-08-04): el layout ya NO encajona todo en max-w-3xl. Eso dejaba el
// ÍNDICE —que es un listado— como una tira angosta en medio de la pantalla, y
// recortaba las infografías. Cada página decide: el índice va full-width con
// grid responsive y el artículo se pone su propio ancho de lectura
// (Theos Place Design System/layout.md: la excepción de lectura aplica al TEXTO,
// no al cascarón).
export default async function AyudaLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext()

  if (ctx) {
    return (
      <AppShell title="Centro de ayuda" showCedulaReminder={false}>
        {children}
      </AppShell>
    )
  }

  return (
    <div className="min-h-screen bg-surface-low">
      <header className="bg-navy">
        <PageContainer width="work" className="flex items-center justify-between gap-3 px-5 py-4">
          <Link href="/" className="flex items-center gap-2.5">
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
            href="/login"
            className="rounded-full border border-white/20 px-3.5 py-1.5 text-[13px] text-white/90 hover:bg-white/10 transition-colors font-body"
          >
            Iniciar sesión
          </Link>
        </PageContainer>
      </header>

      {/* Sin ancho propio: cada página se acota (el índice va en work y el
          artículo en reading). */}
      <main className="px-5 py-6 pb-16">{children}</main>

    </div>
  )
}
