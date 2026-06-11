'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  LayoutDashboard,
  Users,
  Calendar,
  BookOpen,
  UsersRound,
  Briefcase,
  DollarSign,
  MessageCircle,
  FileText,
  X,
  ChevronDown,
  LayoutList,
  BookText,
  UserCheck,
  ArrowLeftRight,
  Inbox,
  BarChart2,
  Plus,
  Tag,
  Bookmark,
  ClipboardList,
  Send,
  Settings,
  LogOut,
  Heart,
  CreditCard,
  GraduationCap,
  Shield,
  Bell,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'

type SubItem = { href: string; label: string; icon: LucideIcon; badge?: number }
type NavModule = { href: string; label: string; icon: LucideIcon; subs: SubItem[]; module: string | null; summaryLabel?: string; badge?: number }

const EVENTOS_SUB: SubItem[] = [
  { href: '/eventos/nuevo',  label: 'Crear evento',     icon: Plus },
  { href: '/eventos/tipos',  label: 'Tipos de evento',  icon: Tag  },
]

const EMPLEADOS_SUB: SubItem[] = [
  { href: '/empleados/puestos', label: 'Puestos pagados', icon: Tag },
]

const FORMULARIOS_SUB: SubItem[] = [
  { href: '/formularios/nuevo', label: 'Nuevo formulario', icon: Plus },
]

const FINANZAS_SUB: SubItem[] = [
  { href: '/finanzas/donaciones',  label: 'Donaciones',   icon: Heart           },
  { href: '/finanzas/pagos',       label: 'Pagos',        icon: CreditCard      },
  { href: '/finanzas/devoluciones',label: 'Devoluciones', icon: ArrowLeftRight  },
  { href: '/finanzas/becas',       label: 'Becas',        icon: GraduationCap   },
  { href: '/finanzas/reportes',    label: 'Reportes',     icon: BarChart2       },
  { href: '/finanzas/solicitudes', label: 'Solicitudes',  icon: Inbox           },
]

const COMUNICACIONES_SUB: SubItem[] = [
  { href: '/comunicaciones/nueva',        label: 'Nueva comunicación', icon: Send     },
  { href: '/comunicaciones/plantillas',   label: 'Plantillas',         icon: FileText },
  { href: '/comunicaciones/configuracion',label: 'Configuración',      icon: Settings },
]

const SERVIDORES_SUB: SubItem[] = [
  { href: '/servidores/vacantes',     label: 'Puestos de Servicio', icon: Bookmark      },
  { href: '/servidores/aplicaciones', label: 'Aplicaciones',        icon: ClipboardList },
]

const ESTUDIOS_SUB: SubItem[] = [
  { href: '/estudios/grupos',      label: 'Grupos',               icon: LayoutList },
  { href: '/estudios/plan',        label: 'Plan de Estudios',     icon: BookText   },
  { href: '/estudios/analisis',    label: 'Análisis de estudios', icon: BarChart2  },
  { href: '/estudios/dirigentes',  label: 'Dirigentes',           icon: UserCheck  },
  { href: '/estudios/solicitudes', label: 'Solicitudes',          icon: Inbox      },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

const ROLE_LABELS: Record<string, string> = {
  admin:        'Administrador',
  finance:      'Finanzas',
  staff_leader: 'Líder de Staff',
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const { can, getScope } = usePermissions()

  // Conteos de solicitudes abiertas para los badges. Los endpoints exigen rol:
  // con 403 simplemente no hay badge.
  const [openRequests, setOpenRequests] = useState(0)
  const [openFinanceRequests, setOpenFinanceRequests] = useState(0)
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  useEffect(() => {
    let alive = true
    fetch('/api/studies/requests?count=open')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d) setOpenRequests(d.count ?? 0) })
      .catch(() => {})
    fetch('/api/finance/requests?count=open')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d) setOpenFinanceRequests(d.count ?? 0) })
      .catch(() => {})
    fetch('/api/notifications/internal')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && Array.isArray(d)) setUnreadNotifs(d.filter((n: { read: boolean }) => !n.read).length) })
      .catch(() => {})
    return () => { alive = false }
  }, [pathname])

  const userName  = user?.name ?? ''
  const userRole  = user?.role ?? ''
  const userRoles = user?.roles ?? []

  const canViewAccesos = userRoles.includes('admin')
  const canViewListas = userRoles.some(r => ['admin', 'direccion', 'comunicaciones'].includes(r))
  const canViewDuplicados = userRoles.some(r => ['admin', 'editor_perfiles'].includes(r))

  // Submenú de Miembros según rol.
  const miembrosSub: SubItem[] = [
    ...(canViewListas ? [{ href: '/miembros/listas', label: 'Listas guardadas', icon: Bookmark }] : []),
    ...(canViewDuplicados ? [{ href: '/miembros/duplicados', label: 'Duplicados', icon: Users }] : []),
  ]

  const estudiosSub: SubItem[] = ESTUDIOS_SUB.map(s =>
    s.href === '/estudios/solicitudes' ? { ...s, badge: openRequests } : s)
  const finanzasSub: SubItem[] = FINANZAS_SUB.map(s =>
    s.href === '/finanzas/solicitudes' ? { ...s, badge: openFinanceRequests } : s)

  // Cada módulo se muestra solo si el rol tiene 'view' sobre él (can combina
  // múltiples roles: coordinador_estudios + comunicaciones ve comunicaciones).
  const ALL_NAV: NavModule[] = [
    { href: '/dashboard',      label: 'Dashboard',      icon: LayoutDashboard, subs: [],                 module: null },
    { href: '/notificaciones', label: 'Notificaciones', icon: Bell,            subs: [],                 module: null, badge: unreadNotifs },
    { href: '/miembros',       label: 'Miembros',       icon: Users,           subs: miembrosSub,        module: 'miembros', summaryLabel: 'Buscar miembros' },
    { href: '/matricula',      label: 'Matrícula',      icon: GraduationCap,   subs: [],                 module: 'estudios' },
    { href: '/eventos',        label: 'Eventos',        icon: Calendar,        subs: EVENTOS_SUB,        module: 'eventos' },
    { href: '/estudios',       label: 'Estudios',       icon: BookOpen,        subs: estudiosSub,        module: 'estudios' },
    { href: '/servidores',     label: 'Servidores',     icon: UsersRound,      subs: SERVIDORES_SUB,     module: 'servidores' },
    { href: '/empleados',      label: 'Empleados',      icon: Briefcase,       subs: EMPLEADOS_SUB,      module: 'empleados' },
    { href: '/finanzas',       label: 'Finanzas',       icon: DollarSign,      subs: finanzasSub,        module: 'finanzas' },
    { href: '/comunicaciones', label: 'Comunicaciones', icon: MessageCircle,   subs: COMUNICACIONES_SUB, module: 'comunicaciones' },
    { href: '/formularios',    label: 'Formularios',    icon: FileText,        subs: FORMULARIOS_SUB,    module: 'formularios' },
  ]
  // El padrón (listado de miembros) exige alcance más allá de 'own' — el rol
  // base 'miembro' ve su perfil, no el listado (espejo del guard de la API).
  const NAV = ALL_NAV.filter(m => !m.module || (can(m.module, 'view')
    && (m.href !== '/miembros' || getScope('miembros') !== 'own')))

  // ── Acordeón exclusivo (mobile y desktop) ──
  const moduleOfPath = NAV.find(m => m.subs.length > 0 && (pathname === m.href || pathname.startsWith(m.href + '/')))?.href ?? null
  const [expandedModule, setExpandedModule] = useState<string | null>(moduleOfPath)
  // Al abrir el menú (mobile) o navegar arranca expandido el módulo de la ruta
  // actual (ajuste de estado durante render — el patrón de React, sin effects).
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setExpandedModule(moduleOfPath)
  }
  const [prevPath, setPrevPath] = useState(pathname)
  if (pathname !== prevPath) {
    setPrevPath(pathname)
    setExpandedModule(moduleOfPath)
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      router.push('/login')
      router.refresh()
    }
  }

  function SubLink({ sub, exactActive }: { sub: SubItem; exactActive?: boolean }) {
    const subActive = exactActive ?? (pathname === sub.href)
    const SubIcon = sub.icon
    return (
      <Link
        href={sub.href}
        onClick={onClose}
        className={cn(
          'group flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition-all duration-150 min-h-[44px] lg:min-h-0',
          subActive ? 'bg-white/15 text-white' : 'text-white/55 hover:bg-white/10 hover:text-white',
        )}
      >
        <SubIcon
          size={14}
          strokeWidth={1.75}
          className={cn('shrink-0', subActive ? 'text-white' : 'text-white/40 group-hover:text-white')}
        />
        <span className="flex-1 font-body font-light">{sub.label}</span>
        {(sub.badge ?? 0) > 0 && (
          <span className="inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-coral px-1 text-[9px] font-bold text-white font-display">
            {sub.badge}
          </span>
        )}
      </Link>
    )
  }

  function ModuleSection({ mod }: { mod: NavModule }) {
    const Icon = mod.icon
    const moduleActive = pathname === mod.href || pathname.startsWith(mod.href + '/')
    const expanded = expandedModule === mod.href

    const headerCls = cn(
      'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-left transition-all duration-150 min-h-[44px] lg:min-h-0',
      moduleActive ? 'bg-coral text-white' : 'text-white/70 hover:bg-white/10 hover:text-white',
    )
    const headerContent = (chevronOpen: boolean) => (
      <>
        <Icon
          size={18}
          strokeWidth={1.75}
          className={cn('shrink-0 transition-colors', moduleActive ? 'text-white' : 'text-white/50 group-hover:text-white')}
        />
        <span className="flex-1 truncate font-body font-light">{mod.label}</span>
        <ChevronDown
          size={14}
          className={cn('transition-transform duration-200', chevronOpen ? 'rotate-180' : 'rotate-0', moduleActive ? 'text-white' : 'text-white/40')}
        />
      </>
    )

    // El módulo NO navega — expande/colapsa su submenú (acordeón exclusivo,
    // mismo comportamiento en mobile y desktop). El primer sub-item ("Resumen")
    // es el acceso a la página principal del módulo.
    return (
      <div>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpandedModule(prev => (prev === mod.href ? null : mod.href))}
          className={headerCls}
        >
          {headerContent(expanded)}
        </button>
        <div
          className={cn(
            'grid transition-[grid-template-rows] duration-200 ease-out',
            expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="overflow-hidden min-h-0">
            <div className="ml-3 mt-0.5 space-y-0.5 border-l border-white/10 pl-3 pb-1">
              <SubLink
                sub={{ href: mod.href, label: mod.summaryLabel ?? 'Resumen', icon: Icon }}
                exactActive={pathname === mod.href}
              />
              {mod.subs.map(sub => <SubLink key={sub.href} sub={sub} />)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-navy-ink/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-full w-60 flex flex-col bg-navy transition-transform duration-300 ease-out',
          'lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/logo-theos-white.png"
              alt="Theos Place"
              width={120}
              height={32}
              className="object-contain"
              priority
            />
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden rounded-md p-1 text-white/60 hover:text-white transition-colors"
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        {/* Divider */}
        <div className="mx-6 h-px bg-white/10" />

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {NAV.map(mod => {
            if (mod.subs.length === 0) {
              // Sin subpáginas: navega directo y cierra el menú (igual en mobile).
              const active = pathname === mod.href || pathname.startsWith(mod.href + '/')
              const Icon = mod.icon
              return (
                <Link
                  key={mod.href}
                  href={mod.href}
                  onClick={onClose}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150 min-h-[44px] lg:min-h-0',
                    active ? 'bg-coral text-white' : 'text-white/70 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <Icon
                    size={18}
                    strokeWidth={1.75}
                    className={cn('shrink-0 transition-colors', active ? 'text-white' : 'text-white/50 group-hover:text-white')}
                  />
                  <span className="flex-1 truncate font-body font-light">{mod.label}</span>
                  {(mod.badge ?? 0) > 0 && (
                    <span className="inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-coral px-1 text-[9px] font-bold text-white font-display">
                      {mod.badge}
                    </span>
                  )}
                </Link>
              )
            }
            return <ModuleSection key={mod.href} mod={mod} />
          })}
        </nav>

        {/* Accesos — solo admin/direccion */}
        {canViewAccesos && (
          <div className="px-3 pb-2">
            <div className="h-px bg-white/10 mb-2" />
            <Link
              href="/accesos"
              onClick={onClose}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150 min-h-[44px] lg:min-h-0',
                pathname === '/accesos' || pathname.startsWith('/accesos/')
                  ? 'bg-coral text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              <Shield
                size={18}
                strokeWidth={1.75}
                className={cn(
                  'shrink-0 transition-colors',
                  pathname === '/accesos' || pathname.startsWith('/accesos/')
                    ? 'text-white'
                    : 'text-white/50 group-hover:text-white'
                )}
              />
              <span className="font-body font-light">Accesos</span>
            </Link>
          </div>
        )}

        {/* Footer — usuario + logout */}
        <div className="px-4 py-4 border-t border-white/10">
          {userName && (
            <div className="flex items-center gap-3 px-2 py-2 mb-2">
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-white bg-[rgba(255,255,255,0.15)] font-display"
              >
                {userName.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-white truncate font-body font-normal">
                  {userName}
                </p>
                <p className="text-[11px] text-white/60 truncate font-body">
                  {ROLE_LABELS[userRole] ?? userRole}
                </p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] text-white/50 hover:bg-white/10 hover:text-white transition-all font-body"
          >
            <LogOut size={14} className="shrink-0" />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  )
}
