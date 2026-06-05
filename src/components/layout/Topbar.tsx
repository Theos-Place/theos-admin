'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Menu, Search, User, Settings, LogOut, ChevronDown } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { ROLES } from '@/data/mock-auth'
import { NotificationsBell } from './NotificationsDropdown'

interface TopbarProps {
  title: string
  onMenuToggle: () => void
}

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || 'TP'
}

export function Topbar({ title, onMenuToggle }: TopbarProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [menuOpen])

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      router.push('/login')
      router.refresh()
    }
  }

  const userInitials = user ? initials(user.name) : 'TP'

  const roleLabel = user?.roles
    ?.map(rid => ROLES.find(r => r.id === rid)?.name)
    .filter(Boolean)
    .join(' · ') ?? ''

  return (
    <header
      className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b px-4 lg:px-6"
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'var(--glass-blur)',
        borderColor: 'var(--outline-variant)',
      }}
    >
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden rounded-lg p-1.5 text-navy-light hover:bg-surface-low transition-colors"
        aria-label="Abrir menú"
      >
        <Menu size={22} />
      </button>

      {/* Page title */}
      <h1
        className="text-lg text-navy shrink-0"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.01em' }}
      >
        {title}
      </h1>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search */}
      <div className="hidden sm:flex items-center gap-2 rounded-xl bg-surface-low px-3 py-2 w-56 lg:w-72 transition-all focus-within:ring-1 focus-within:ring-coral/30">
        <Search size={16} className="text-navy-light/50 shrink-0" strokeWidth={1.75} />
        <input
          type="search"
          placeholder="Buscar…"
          className="flex-1 bg-transparent text-sm text-navy placeholder-navy-light/40 outline-none"
          style={{ fontFamily: 'var(--font-body)', fontWeight: 300 }}
        />
      </div>

      {/* Notifications */}
      <NotificationsBell />

      {/* Avatar + dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="flex items-center gap-1.5 rounded-full hover:bg-surface-low transition-colors pl-1 pr-1 py-1"
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-white text-xs font-bold tracking-wide"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {userInitials}
          </div>
          <ChevronDown
            size={14}
            className={`hidden sm:block text-navy-light/40 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 top-[calc(100%+8px)] w-64 rounded-2xl overflow-hidden"
            style={{
              background: 'var(--surface-card)',
              boxShadow: '0 20px 48px rgba(22,20,64,0.14)',
              border: '1px solid var(--outline-variant)',
              zIndex: 50,
            }}
          >
            {/* User info */}
            <div
              className="px-4 py-3.5 border-b"
              style={{ borderColor: 'var(--outline-variant)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold text-white"
                  style={{ background: '#161440', fontFamily: 'var(--font-display)' }}
                >
                  {userInitials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy truncate" style={{ fontFamily: 'var(--font-body)' }}>
                    {user?.name ?? 'Usuario'}
                  </p>
                  <p className="text-[11px] text-navy-light/50 truncate" style={{ fontFamily: 'var(--font-body)' }}>
                    {user?.email ?? ''}
                  </p>
                  {roleLabel && (
                    <p className="text-[11px] text-teal-deep mt-0.5 truncate" style={{ fontFamily: 'var(--font-body)' }}>
                      {roleLabel}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Menu items */}
            <div className="py-1.5">
              <Link
                href={user?.member_id ? `/miembros/${user.member_id}` : '#'}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <User size={15} className="text-navy-light/50 shrink-0" />
                Mi perfil
              </Link>
              <Link
                href="/configuracion"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <Settings size={15} className="text-navy-light/50 shrink-0" />
                Configuración
              </Link>
            </div>

            <div className="border-t py-1.5" style={{ borderColor: 'var(--outline-variant)' }}>
              <button
                onClick={() => { setMenuOpen(false); handleLogout() }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-coral hover:bg-coral/5 transition-colors"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <LogOut size={15} className="shrink-0" />
                Cerrar sesión
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
