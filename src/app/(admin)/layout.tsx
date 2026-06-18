'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { AccessDenied } from '@/components/shared/AccessDenied'
import { SedesProvider } from '@/lib/sedes'
import { OrgProvider } from '@/lib/org'
import { AuthProvider, useAuth } from '@/lib/auth/auth-context'
import { usePermissions } from '@/hooks/usePermissions'
import { ToastProvider } from '@/components/shared/Toast'

const pageTitles: Record<string, string> = {
  '/dashboard':      'Dashboard',
  '/miembros':       'Miembros',
  '/eventos':        'Eventos',
  '/estudios':       'Estudios',
  '/servidores':     'Servidores',
  '/dirigentes':     'Dirigentes',
  '/empleados':      'Empleados',
  '/finanzas':       'Finanzas',
  '/comunicaciones': 'Comunicaciones',
  '/formularios':    'Formularios',
  '/reportes':       'Reportes',
}

function getTitle(pathname: string): string {
  const match = Object.keys(pageTitles)
    .sort((a, b) => b.length - a.length)
    .find(key => pathname === key || pathname.startsWith(key + '/'))
  return match ? pageTitles[match] : 'Admin'
}

// Módulo de permisos por prefijo de ruta — acceso por URL directa incluido.
// (Las rutas API son el enforcement real; esto evita pantallas vacías/rotas.)
const MODULE_BY_PREFIX: Record<string, string> = {
  '/miembros':       'miembros',
  '/matricula':      'estudios',
  '/eventos':        'eventos',
  '/estudios':       'estudios',
  '/servidores':     'servidores',
  '/empleados':      'empleados',
  '/finanzas':       'finanzas',
  '/comunicaciones': 'comunicaciones',
  '/formularios':    'formularios',
  '/reportes':       'reportes',
  '/accesos':        'accesos',
}

/** Bloquea el contenido del módulo si el rol no tiene 'view' sobre él. */
function ModuleGuard({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const { user, loaded } = useAuth()
  const { can, getScope } = usePermissions()
  const prefix = Object.keys(MODULE_BY_PREFIX)
    .sort((a, b) => b.length - a.length)
    .find(p => pathname === p || pathname.startsWith(p + '/'))
  if (!prefix) return <>{children}</>
  // Hasta que carguen los roles no se decide (evita denegar en falso).
  if (!loaded || !user) return <>{children}</>
  if (!can(MODULE_BY_PREFIX[prefix], 'view')) return <AccessDenied />
  // El padrón exige alcance más allá de 'own' (espejo del guard de la API);
  // el rol base 'miembro' ve su perfil desde otras vistas, no el listado.
  if (prefix === '/miembros' && getScope('miembros') === 'own') return <AccessDenied />
  return <>{children}</>
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const title = getTitle(pathname)

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
            <ErrorBoundary>
              <ModuleGuard pathname={pathname}>
                {children}
              </ModuleGuard>
            </ErrorBoundary>
          </main>
        </div>
      </div>
      </OrgProvider>
    </SedesProvider>
    </ToastProvider>
    </AuthProvider>
  )
}
