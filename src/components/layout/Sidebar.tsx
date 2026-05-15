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
  Star,
  Briefcase,
  DollarSign,
  MessageCircle,
  FileText,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard',     label: 'Dashboard',            icon: LayoutDashboard },
  { href: '/miembros',      label: 'Miembros',             icon: Users,          badge: '23k' },
  { href: '/eventos',       label: 'Eventos',              icon: Calendar },
  { href: '/estudios',      label: 'Estudios',             icon: BookOpen },
  { href: '/voluntarios',   label: 'Voluntarios / Comités',icon: UsersRound },
  { href: '/dirigentes',    label: 'Dirigentes',           icon: Star },
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
          {navItems.map(({ href, label, icon: Icon, badge }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
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
                {badge && (
                  <span className="rounded-full bg-teal/20 px-1.5 py-0.5 text-[11px] text-teal-soft tabular-nums">
                    {badge}
                  </span>
                )}
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
