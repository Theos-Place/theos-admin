'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'

const EVENTOS_SUB = [
  { href: '/eventos/nuevo',  label: 'Crear evento',     icon: Plus },
  { href: '/eventos/tipos',  label: 'Tipos de evento',  icon: Tag  },
]

const ESTUDIOS_SUB = [
  { href: '/estudios/grupos',          label: 'Grupos',           icon: LayoutList },
  { href: '/estudios/curriculo',       label: 'Currículo',        icon: BookText },
  { href: '/estudios/dirigentes',      label: 'Dirigentes',       icon: UserCheck },
  { href: '/estudios/lista-de-espera', label: 'Lista de espera',  icon: Clock },
  { href: '/estudios/reubicaciones',   label: 'Reubicaciones',    icon: ArrowLeftRight },
  { href: '/estudios/analisis',        label: 'Análisis',         icon: BarChart2 },
]

const navItems = [
  { href: '/dashboard',     label: 'Dashboard',            icon: LayoutDashboard },
  { href: '/miembros',      label: 'Miembros',             icon: Users },
  { href: '/eventos',       label: 'Eventos',              icon: Calendar },
  { href: '/estudios',      label: 'Estudios',             icon: BookOpen },
  { href: '/voluntarios',   label: 'Voluntarios / Comités',icon: UsersRound },
  { href: '/empleados',     label: 'Empleados',            icon: Briefcase },
  { href: '/finanzas',      label: 'Finanzas',             icon: DollarSign },
  { href: '/comunicaciones',label: 'Comunicaciones',       icon: MessageCircle },
  { href: '/formularios',   label: 'Formularios',          icon: FileText },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const estudiosActive = pathname === '/estudios' || pathname.startsWith('/estudios/')
  const eventosActive  = pathname === '/eventos'  || pathname.startsWith('/eventos/')

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

        {/* Footer */}
        <div className="px-6 py-5">
          <p
            className="text-[11px] text-white/30 tracking-widest uppercase"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            THEOS PLACE · ADMIN
          </p>
        </div>
      </aside>
    </>
  )
}
