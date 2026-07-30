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
import { canSeeSummaryRoute } from '@/lib/auth/module-summary'
import { SELECTION_REVIEW_ROLES } from '@/lib/forms/selection-rules'
import { ToastProvider } from '@/components/shared/Toast'
import { CedulaReminderBanner } from '@/components/members/CedulaReminderBanner'

const pageTitles: Record<string, string> = {
  '/dashboard':      'Dashboard',
  '/miembros':       'Miembros',
  '/eventos':        'Eventos',
  '/estudios':       'Estudios',
  '/servidores':     'Servidores',
  '/dirigentes':     'Dirigentes',
  '/empleados':      'Empleados',
  '/finanzas':       'Finanzas',
  '/finanzas/becas': 'Becas',
  '/comunicaciones': 'Comunicaciones',
  '/formularios':    'Formularios',
  '/reportes':       'Reportes',
  '/matricula':      'Matrícula',
  '/notificaciones': 'Notificaciones',
  '/accesos':        'Accesos',
  '/configuracion':  'Configuración',
  // REV-3: /pagos/revision ahora redirige a /finanzas/pagos (página unificada).
  '/finanzas/pagos': 'Pagos',
  '/mis-pagos':      'Pagos pendientes',
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
  // Excepción: /estudios/folletos tiene su propio permiso (rol 'folletos' sin
  // módulo estudios) — espejo del sidebar, que muestra el ítem con ese permiso.
  if (pathname.startsWith('/estudios/folletos') && can('folletos', 'view')) return <>{children}</>
  // Excepción: /finanzas/becas tiene su propio permiso ('becas'), asignable sin
  // depender del módulo finanzas completo.
  if (pathname.startsWith('/finanzas/becas') && can('becas', 'view')) return <>{children}</>
  // Excepción (REV-3): /finanzas/pagos es la página unificada de pagos — los
  // roles de revisión (revision_pagos, folletos, coordinadores) la ven sin el
  // módulo finanzas completo. Espejo del guard de GET /api/finance/payments.
  if (pathname.startsWith('/finanzas/pagos') && can('revision_pagos', 'view')) return <>{children}</>
  // Excepción: /formularios/[id]/responder es el llenado de un formulario —
  // cualquier sesión autenticada (las convocatorias por correo apuntan ahí).
  // El módulo formularios (dirección/admin) sigue exigiéndose para el resto.
  if (/^\/formularios\/[0-9a-f-]{36}\/responder$/i.test(pathname)) return <>{children}</>
  // Excepción (EST-10): /formularios/[id]/seleccion es la revisión del comité de
  // una preinscripción — la ven los coordinadores de dirigentes/estudios sin el
  // módulo formularios. Espejo del gate de /api/forms/[id]/selection.
  if (/^\/formularios\/[0-9a-f-]{36}\/seleccion$/i.test(pathname)
      && (user.roles ?? []).some(r => (SELECTION_REVIEW_ROLES as readonly string[]).includes(r))) {
    return <>{children}</>
  }
  // Excepción: /eventos (raíz) es también la pantalla de auto-inscripción de
  // cualquier miembro (antes /mis-eventos aparte); la propia página decide qué
  // mostrar según el permiso. Las subrutas de gestión (/eventos/nuevo,
  // /eventos/[id]/editar, etc.) siguen exigiendo el módulo normalmente.
  if (pathname === '/eventos') return <>{children}</>
  if (!can(MODULE_BY_PREFIX[prefix], 'view')) return <AccessDenied />
  // SEC-1: la RAÍZ de estudios/servidores es un resumen de toda la organización
  // — exige alcance 'all' (dirigente ve sus grupos; lider_comite, su comité).
  // La regla es por RUTA: /matricula mapea al módulo estudios pero es el
  // autoservicio del miembro, no un resumen.
  if (!canSeeSummaryRoute(pathname, getScope(MODULE_BY_PREFIX[prefix]))) return <AccessDenied />
  // SEC-1: estudios con alcance 'own' (can() no mira scope, así que dirigente
  // y miembro pasan el chequeo de arriba). Dirigente: solo la raíz, sus grupos
  // y el detalle/asistencia de un grupo (el API ya filtra a los suyos).
  // Miembro: el detalle de un grupo (vista read-only de SU grupo, gateada por
  // inscripción en el API). /estudios/plan (el CURRÍCULO) es abierto para
  // cualquier sesión — decisión 2026-07-29; el detalle/edición de un plan
  // sigue gateado en su propia página (STUDY_ADMIN).
  if (prefix === '/estudios' && getScope('estudios') === 'own') {
    const groupDetail = /^\/estudios\/grupos\/[0-9a-f-]{36}(\/asistencia)?$/i.test(pathname)
    const isDirigente = (user.roles ?? []).includes('dirigente')
    const isPlanCurriculum = pathname === '/estudios/plan'
    // (El resumen /estudios ya quedó bloqueado arriba: exige alcance 'all'.)
    const allowed = isPlanCurriculum || (isDirigente
      ? pathname === '/estudios/grupos' || groupDetail
      : /^\/estudios\/grupos\/[0-9a-f-]{36}$/i.test(pathname))
    if (!allowed) return <AccessDenied />
  }
  // SEC-1: el LISTADO del padrón exige alcance 'all' — lider_comite (scope
  // 'committee') ve a su gente en /servidores; el detalle de un perfil sí le
  // queda accesible por link directo (mismo criterio del API).
  if (pathname === '/miembros' && getScope('miembros') !== 'all') return <AccessDenied />
  // El padrón exige alcance más allá de 'own' (espejo del guard de la API);
  // el rol base 'miembro' ve su perfil o el de su familia desde ACÁ mismo
  // (/miembros/{id} de detalle), no el listado completo (/miembros).
  if (prefix === '/miembros' && getScope('miembros') === 'own') {
    // Detalle: propio o familia. Editar (/editar): SOLO la propia ficha
    // (self-service para completar cédula/datos), no la de familia.
    const m = pathname.match(/^\/miembros\/([0-9a-f-]{36})(\/editar)?$/i)
    const targetId = m?.[1]
    const isEdit = !!m?.[2]
    const allowedIds = [user.member_id, ...(user.family_member_ids ?? [])]
    const ok = !!targetId && (isEdit ? targetId === user.member_id : allowedIds.includes(targetId))
    if (!ok) return <AccessDenied />
  }
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
            <CedulaReminderBanner />
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
