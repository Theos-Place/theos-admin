'use client'

// El cascarón del sistema: sidebar + topbar + providers. Lo usa el layout de
// (admin) y también /ayuda cuando hay sesión — decisión 2026-07-31: el centro de
// ayuda se consulta EN MEDIO de una tarea, así que perder el menú obliga a
// volver con el botón del navegador. Sin sesión, /ayuda se pinta sola (no hay
// menú que mostrar).
//
// El gate de módulo NO vive acá: lo pone quien lo necesita (el layout de admin
// envuelve children con su ModuleGuard antes de pasarlos).

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { SedesProvider } from '@/lib/sedes'
import { OrgProvider } from '@/lib/org'
import { AuthProvider } from '@/lib/auth/auth-context'
import { ToastProvider } from '@/components/shared/Toast'
import { CedulaReminderBanner } from '@/components/members/CedulaReminderBanner'

export function AppShell({
  title,
  children,
  showCedulaReminder = true,
}: {
  title: string
  children: React.ReactNode
  /** El recordatorio de cédula no aplica en páginas de lectura (ayuda). */
  showCedulaReminder?: boolean
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <AuthProvider>
      <ToastProvider>
        <SedesProvider>
          <OrgProvider>
            <div className="min-h-screen bg-surface">
              <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

              {/* Main content — offset for the fixed sidebar on desktop */}
              <div className="lg:pl-60 flex flex-col min-h-screen min-w-0">
                <Topbar title={title} onMenuToggle={() => setSidebarOpen(true)} />
                {/* overflow-x-clip: ninguna página puede provocar scroll horizontal del
                    viewport en mobile; clip (no hidden) no crea contenedor de scroll, así
                    que no rompe los position:sticky internos (p. ej. la barra de editar). */}
                <main className="flex-1 p-4 lg:p-6 min-w-0 overflow-x-clip">
                  {showCedulaReminder && <CedulaReminderBanner />}
                  <ErrorBoundary>{children}</ErrorBoundary>
                </main>
              </div>
            </div>
          </OrgProvider>
        </SedesProvider>
      </ToastProvider>
    </AuthProvider>
  )
}
