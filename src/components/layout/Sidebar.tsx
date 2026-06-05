'use client'

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
  Clock,
  ArrowLeftRight,
  BarChart2,
  Plus,
  Tag,
  LayoutGrid,
  Bookmark,
  ClipboardList,
  LayoutDashboard as PanelIcon,
  Send,
  Settings,
  LogOut,
  Heart,
  CreditCard,
  GraduationCap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Shield } from 'lucide-react'
import { useMockAuth } from '@/hooks/useMockAuth'

const EVENTOS_SUB = [
  { href: '/eventos/nuevo',  label: 'Crear evento',     icon: Plus },
  { href: '/eventos/tipos',  label: 'Tipos de evento',  icon: Tag  },
]

const EMPLEADOS_SUB = [
  { href: '/empleados',         label: 'Lista de empleados', icon: Users     },
  { href: '/empleados/puestos', label: 'Puestos pagados',    icon: Tag       },
]

const FORMULARIOS_SUB = [
  { href: '/formularios',       label: 'Todos los formularios', icon: FileText  },
  { href: '/formularios/nuevo', label: 'Nuevo formulario',      icon: Plus      },
]

const FINANZAS_SUB = [
  { href: '/finanzas',             label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/finanzas/donaciones',  label: 'Donaciones',   icon: Heart           },
  { href: '/finanzas/pagos',       label: 'Pagos',        icon: CreditCard      },
  { href: '/finanzas/devoluciones',label: 'Devoluciones', icon: ArrowLeftRight  },
  { href: '/finanzas/becas',       label: 'Becas',        icon: GraduationCap   },
  { href: '/finanzas/reportes',    label: 'Reportes',     icon: BarChart2       },
]

const COMUNICACIONES_SUB = [
  { href: '/comunicaciones',              label: 'Panel principal',    icon: PanelIcon   },
  { href: '/comunicaciones/nueva',        label: 'Nueva comunicación', icon: Send        },
  { href: '/comunicaciones/plantillas',   label: 'Plantillas',         icon: FileText    },
  { href: '/comunicaciones/configuracion',label: 'Configuración',      icon: Settings    },
]

const MIEMBROS_SUB = [
  { href: '/miembros/listas', label: 'Listas guardadas',   icon: Bookmark  },
]

const SERVIDORES_SUB = [
  { href: '/servidores',                label: 'Por comités',          icon: LayoutGrid   },
  { href: '/servidores/vacantes',       label: 'Vacantes',             icon: Bookmark     },
  { href: '/servidores/aplicaciones',   label: 'Aplicaciones',         icon: ClipboardList},
]

const ESTUDIOS_SUB = [
  { href: '/estudios/grupos',          label: 'Grupos',           icon: LayoutList },
  { href: '/estudios/plan',            label: 'Plan de Estudios', icon: BookText },
  { href: '/estudios/dirigentes',      label: 'Dirigentes',       icon: UserCheck },
  { href: '/estudios/lista-de-espera', label: 'Lista de espera',  icon: Clock },
  { href: '/estudios/reubicaciones',   label: 'Reubicaciones',    icon: ArrowLeftRight },
]

const navItems = [
  { href: '/dashboard',     label: 'Dashboard',            icon: LayoutDashboard },
  { href: '/miembros',      label: 'Miembros',             icon: Users },
  { href: '/matricula',     label: 'Matrícula',            icon: GraduationCap },
  { href: '/eventos',       label: 'Eventos',              icon: Calendar },
  { href: '/estudios',      label: 'Estudios',             icon: BookOpen },
  { href: '/servidores',    label: 'Servidores',            icon: UsersRound },
  { href: '/empleados',     label: 'Empleados',            icon: Briefcase },
  { href: '/finanzas',      label: 'Finanzas',             icon: DollarSign },
  { href: '/comunicaciones',label: 'Comunicaciones',       icon: MessageCircle },
  { href: '/formularios',   label: 'Formularios',          icon: FileText },
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
  const { user } = useMockAuth()
  const userName  = user?.name ?? ''
  const userRole  = user?.role ?? ''
  const userRoles = user?.roles ?? []

  const canViewAccesos = userRoles.some(r => r === 'admin' || r === 'direccion')

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      router.push('/login')
      router.refresh()
    }
  }
  const miembrosActive        = pathname === '/miembros'        || pathname.startsWith('/miembros/')
  const estudiosActive        = pathname === '/estudios'        || pathname.startsWith('/estudios/')
  const eventosActive         = pathname === '/eventos'         || pathname.startsWith('/eventos/')
  const servidoresActive      = pathname === '/servidores'      || pathname.startsWith('/servidores/')
  const empleadosActive       = pathname === '/empleados'       || pathname.startsWith('/empleados/')
  const formulariosActive     = pathname === '/formularios'     || pathname.startsWith('/formularios/')
  const comunicacionesActive  = pathname === '/comunicaciones'  || pathname.startsWith('/comunicaciones/')
  const finanzasActive        = pathname === '/finanzas'        || pathname.startsWith('/finanzas/')

  const canViewListas = userRoles.some(r => ['admin', 'direccion', 'comunicaciones'].includes(r))

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
          {navItems.map(({ href, label, icon: Icon }) => {
            const isEstudios = href === '/estudios'
            const isEventos  = href === '/eventos'
            const active = isEstudios
              ? pathname === '/estudios'
              : isEventos
              ? pathname === '/eventos'
              : pathname === href || pathname.startsWith(href + '/')

            const isMiembros       = href === '/miembros'
            const isEmpleados      = href === '/empleados'
            const isServidores     = href === '/servidores'
            const isFormularios    = href === '/formularios'
            const isComunicaciones = href === '/comunicaciones'
            const isFinanzas       = href === '/finanzas'

          if (isMiembros) {
            return (
              <div key={href}>
                <Link
                  href={href}
                  onClick={onClose}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150',
                    miembrosActive ? 'bg-coral text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <Icon size={18} strokeWidth={1.75} className={cn('shrink-0 transition-colors', miembrosActive ? 'text-white' : 'text-white/50 group-hover:text-white')} />
                  <span className="flex-1 truncate" style={{ fontFamily: 'var(--font-body)', fontWeight: 300 }}>{label}</span>
                  {canViewListas && (
                    <ChevronDown size={14} className={cn('transition-transform duration-200', miembrosActive ? 'text-white rotate-180' : 'text-white/40')} />
                  )}
                </Link>
                {miembrosActive && canViewListas && (
                  <div className="ml-3 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                    {MIEMBROS_SUB.map(({ href: sub, label: subLabel, icon: SubIcon }) => {
                      const subActive = pathname === sub
                      return (
                        <Link
                          key={sub}
                          href={sub}
                          onClick={onClose}
                          className={cn(
                            'group flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition-all duration-150',
                            subActive ? 'bg-white/15 text-white' : 'text-white/55 hover:bg-white/10 hover:text-white'
                          )}
                        >
                          <SubIcon size={14} strokeWidth={1.75} className={cn('shrink-0', subActive ? 'text-white' : 'text-white/40 group-hover:text-white')} />
                          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 300 }}>{subLabel}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          if (isFinanzas) {
            return (
              <div key={href}>
                <Link
                  href={href}
                  onClick={onClose}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150',
                    finanzasActive
                      ? 'bg-coral text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <Icon size={18} strokeWidth={1.75} className={cn('shrink-0 transition-colors', finanzasActive ? 'text-white' : 'text-white/50 group-hover:text-white')} />
                  <span className="flex-1 truncate" style={{ fontFamily: 'var(--font-body)', fontWeight: 300 }}>{label}</span>
                  <ChevronDown size={14} className={cn('transition-transform duration-200', finanzasActive ? 'text-white rotate-180' : 'text-white/40 rotate-0')} />
                </Link>
                {finanzasActive && (
                  <div className="ml-3 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                    {FINANZAS_SUB.map(({ href: sub, label: subLabel, icon: SubIcon }) => {
                      const subActive = pathname === sub || (sub !== '/finanzas' && pathname.startsWith(sub + '/'))
                      return (
                        <Link
                          key={sub}
                          href={sub}
                          onClick={onClose}
                          className={cn(
                            'group flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition-all duration-150',
                            subActive ? 'bg-white/15 text-white' : 'text-white/55 hover:bg-white/10 hover:text-white'
                          )}
                        >
                          <SubIcon size={14} strokeWidth={1.75} className={cn('shrink-0', subActive ? 'text-white' : 'text-white/40 group-hover:text-white')} />
                          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 300 }}>{subLabel}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          if (isEmpleados) {
            return (
              <div key={href}>
                <Link
                  href={href}
                  onClick={onClose}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150',
                    empleadosActive
                      ? 'bg-coral text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <Icon
                    size={18}
                    strokeWidth={1.75}
                    className={cn(
                      'shrink-0 transition-colors',
                      empleadosActive ? 'text-white' : 'text-white/50 group-hover:text-white'
                    )}
                  />
                  <span
                    className="flex-1 truncate"
                    style={{ fontFamily: 'var(--font-body)', fontWeight: 300 }}
                  >
                    {label}
                  </span>
                  <ChevronDown
                    size={14}
                    className={cn(
                      'transition-transform duration-200',
                      empleadosActive ? 'text-white rotate-180' : 'text-white/40 rotate-0'
                    )}
                  />
                </Link>
                {empleadosActive && (
                  <div className="ml-3 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                    {EMPLEADOS_SUB.map(({ href: sub, label: subLabel, icon: SubIcon }) => {
                      const subActive = pathname === sub || (sub !== '/empleados' && pathname.startsWith(sub + '/'))
                      return (
                        <Link
                          key={sub}
                          href={sub}
                          onClick={onClose}
                          className={cn(
                            'group flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition-all duration-150',
                            subActive
                              ? 'bg-white/15 text-white'
                              : 'text-white/55 hover:bg-white/10 hover:text-white'
                          )}
                        >
                          <SubIcon
                            size={14}
                            strokeWidth={1.75}
                            className={cn(
                              'shrink-0',
                              subActive ? 'text-white' : 'text-white/40 group-hover:text-white'
                            )}
                          />
                          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 300 }}>
                            {subLabel}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          if (isServidores) {
            return (
              <div key={href}>
                <Link
                  href={href}
                  onClick={onClose}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150',
                    servidoresActive
                      ? 'bg-coral text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <Icon
                    size={18}
                    strokeWidth={1.75}
                    className={cn(
                      'shrink-0 transition-colors',
                      servidoresActive ? 'text-white' : 'text-white/50 group-hover:text-white'
                    )}
                  />
                  <span
                    className="flex-1 truncate"
                    style={{ fontFamily: 'var(--font-body)', fontWeight: 300 }}
                  >
                    {label}
                  </span>
                  <ChevronDown
                    size={14}
                    className={cn(
                      'transition-transform duration-200',
                      servidoresActive ? 'text-white rotate-180' : 'text-white/40 rotate-0'
                    )}
                  />
                </Link>
                {servidoresActive && (
                  <div className="ml-3 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                    {SERVIDORES_SUB.map(({ href: sub, label: subLabel, icon: SubIcon }) => {
                      const subActive = pathname === sub || (sub !== '/servidores' && pathname.startsWith(sub + '/'))
                      return (
                        <Link
                          key={sub}
                          href={sub}
                          onClick={onClose}
                          className={cn(
                            'group flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition-all duration-150',
                            subActive
                              ? 'bg-white/15 text-white'
                              : 'text-white/55 hover:bg-white/10 hover:text-white'
                          )}
                        >
                          <SubIcon
                            size={14}
                            strokeWidth={1.75}
                            className={cn(
                              'shrink-0',
                              subActive ? 'text-white' : 'text-white/40 group-hover:text-white'
                            )}
                          />
                          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 300 }}>
                            {subLabel}
                          </span>
                        </Link>
                      )
                    })}
                    {userRoles.some(r => ['admin', 'direccion', 'encargado_staff'].includes(r)) && (
                      <Link
                        href="/servidores/admin"
                        onClick={onClose}
                        className={cn(
                          'group flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition-all duration-150',
                          pathname === '/servidores/admin'
                            ? 'bg-white/15 text-white'
                            : 'text-white/55 hover:bg-white/10 hover:text-white'
                        )}
                      >
                        <Settings
                          size={14}
                          strokeWidth={1.75}
                          className={cn(
                            'shrink-0',
                            pathname === '/servidores/admin' ? 'text-white' : 'text-white/40 group-hover:text-white'
                          )}
                        />
                        <span style={{ fontFamily: 'var(--font-body)', fontWeight: 300 }}>
                          Áreas y comités
                        </span>
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )
          }

          if (isComunicaciones) {
            return (
              <div key={href}>
                <Link
                  href={href}
                  onClick={onClose}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150',
                    comunicacionesActive
                      ? 'bg-coral text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <Icon size={18} strokeWidth={1.75} className={cn('shrink-0 transition-colors', comunicacionesActive ? 'text-white' : 'text-white/50 group-hover:text-white')} />
                  <span className="flex-1 truncate" style={{ fontFamily: 'var(--font-body)', fontWeight: 300 }}>{label}</span>
                  <ChevronDown size={14} className={cn('transition-transform duration-200', comunicacionesActive ? 'text-white rotate-180' : 'text-white/40 rotate-0')} />
                </Link>
                {comunicacionesActive && (
                  <div className="ml-3 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                    {COMUNICACIONES_SUB.map(({ href: sub, label: subLabel, icon: SubIcon }) => {
                      const subActive = pathname === sub || (sub !== '/comunicaciones' && pathname.startsWith(sub + '/'))
                      return (
                        <Link
                          key={sub}
                          href={sub}
                          onClick={onClose}
                          className={cn(
                            'group flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition-all duration-150',
                            subActive ? 'bg-white/15 text-white' : 'text-white/55 hover:bg-white/10 hover:text-white'
                          )}
                        >
                          <SubIcon size={14} strokeWidth={1.75} className={cn('shrink-0', subActive ? 'text-white' : 'text-white/40 group-hover:text-white')} />
                          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 300 }}>{subLabel}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          if (isFormularios) {
            return (
              <div key={href}>
                <Link
                  href={href}
                  onClick={onClose}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150',
                    formulariosActive
                      ? 'bg-coral text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <Icon size={18} strokeWidth={1.75} className={cn('shrink-0 transition-colors', formulariosActive ? 'text-white' : 'text-white/50 group-hover:text-white')} />
                  <span className="flex-1 truncate" style={{ fontFamily: 'var(--font-body)', fontWeight: 300 }}>{label}</span>
                  <ChevronDown size={14} className={cn('transition-transform duration-200', formulariosActive ? 'text-white rotate-180' : 'text-white/40 rotate-0')} />
                </Link>
                {formulariosActive && (
                  <div className="ml-3 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                    {FORMULARIOS_SUB.map(({ href: sub, label: subLabel, icon: SubIcon }) => {
                      const subActive = pathname === sub || (sub !== '/formularios' && pathname.startsWith(sub + '/'))
                      return (
                        <Link
                          key={sub}
                          href={sub}
                          onClick={onClose}
                          className={cn(
                            'group flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition-all duration-150',
                            subActive ? 'bg-white/15 text-white' : 'text-white/55 hover:bg-white/10 hover:text-white'
                          )}
                        >
                          <SubIcon size={14} strokeWidth={1.75} className={cn('shrink-0', subActive ? 'text-white' : 'text-white/40 group-hover:text-white')} />
                          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 300 }}>{subLabel}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          if (isEventos) {
              return (
                <div key={href}>
                  <Link
                    href={href}
                    onClick={onClose}
                    className={cn(
                      'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150',
                      eventosActive
                        ? 'bg-coral text-white'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    <Icon
                      size={18}
                      strokeWidth={1.75}
                      className={cn(
                        'shrink-0 transition-colors',
                        eventosActive ? 'text-white' : 'text-white/50 group-hover:text-white'
                      )}
                    />
                    <span
                      className="flex-1 truncate"
                      style={{ fontFamily: 'var(--font-body)', fontWeight: 300 }}
                    >
                      {label}
                    </span>
                    <ChevronDown
                      size={14}
                      className={cn(
                        'transition-transform duration-200',
                        eventosActive ? 'text-white rotate-180' : 'text-white/40 rotate-0'
                      )}
                    />
                  </Link>
                  {eventosActive && (
                    <div className="ml-3 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                      {EVENTOS_SUB.map(({ href: sub, label: subLabel, icon: SubIcon }) => {
                        const subActive = pathname === sub || pathname.startsWith(sub + '/')
                        return (
                          <Link
                            key={sub}
                            href={sub}
                            onClick={onClose}
                            className={cn(
                              'group flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition-all duration-150',
                              subActive
                                ? 'bg-white/15 text-white'
                                : 'text-white/55 hover:bg-white/10 hover:text-white'
                            )}
                          >
                            <SubIcon
                              size={14}
                              strokeWidth={1.75}
                              className={cn(
                                'shrink-0',
                                subActive ? 'text-white' : 'text-white/40 group-hover:text-white'
                              )}
                            />
                            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 300 }}>
                              {subLabel}
                            </span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            if (isEstudios) {
              return (
                <div key={href}>
                  <Link
                    href={href}
                    onClick={onClose}
                    className={cn(
                      'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150',
                      estudiosActive
                        ? 'bg-coral text-white'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    <Icon
                      size={18}
                      strokeWidth={1.75}
                      className={cn(
                        'shrink-0 transition-colors',
                        estudiosActive ? 'text-white' : 'text-white/50 group-hover:text-white'
                      )}
                    />
                    <span
                      className="flex-1 truncate"
                      style={{ fontFamily: 'var(--font-body)', fontWeight: 300 }}
                    >
                      {label}
                    </span>
                    <ChevronDown
                      size={14}
                      className={cn(
                        'transition-transform duration-200',
                        estudiosActive ? 'text-white rotate-180' : 'text-white/40 rotate-0'
                      )}
                    />
                  </Link>

                  {/* Sub-items */}
                  {estudiosActive && (
                    <div className="ml-3 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                      {ESTUDIOS_SUB.map(({ href: sub, label: subLabel, icon: SubIcon }) => {
                        const subActive = pathname === sub || pathname.startsWith(sub + '/')
                        return (
                          <Link
                            key={sub}
                            href={sub}
                            onClick={onClose}
                            className={cn(
                              'group flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition-all duration-150',
                              subActive
                                ? 'bg-white/15 text-white'
                                : 'text-white/55 hover:bg-white/10 hover:text-white'
                            )}
                          >
                            <SubIcon
                              size={14}
                              strokeWidth={1.75}
                              className={cn(
                                'shrink-0',
                                subActive ? 'text-white' : 'text-white/40 group-hover:text-white'
                              )}
                            />
                            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 300 }}>
                              {subLabel}
                            </span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150',
                  active
                    ? 'bg-coral text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                )}
              >
                <Icon
                  size={18}
                  strokeWidth={1.75}
                  className={cn(
                    'shrink-0 transition-colors',
                    active ? 'text-white' : 'text-white/50 group-hover:text-white'
                  )}
                />
                <span
                  className="flex-1 truncate"
                  style={{ fontFamily: 'var(--font-body)', fontWeight: 300 }}
                >
                  {label}
                </span>
              </Link>
            )
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
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150',
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
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 300 }}>Accesos</span>
            </Link>
          </div>
        )}

        {/* Footer — usuario + logout */}
        <div className="px-4 py-4 border-t border-white/10">
          {userName && (
            <div className="flex items-center gap-3 px-2 py-2 mb-2">
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-white"
                style={{ background: 'rgba(255,255,255,0.15)', fontFamily: 'var(--font-display)' }}
              >
                {userName.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-white truncate" style={{ fontFamily: 'var(--font-body)', fontWeight: 400 }}>
                  {userName}
                </p>
                <p className="text-[11px] text-white/40 truncate" style={{ fontFamily: 'var(--font-body)' }}>
                  {ROLE_LABELS[userRole] ?? userRole}
                </p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] text-white/50 hover:bg-white/10 hover:text-white transition-all"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <LogOut size={14} className="shrink-0" />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  )
}
