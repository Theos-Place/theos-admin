'use client'

import { Menu, Search, Bell } from 'lucide-react'

interface TopbarProps {
  title: string
  onMenuToggle: () => void
}

export function Topbar({ title, onMenuToggle }: TopbarProps) {
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
      <button className="relative rounded-lg p-1.5 text-navy-light hover:bg-surface-low transition-colors">
        <Bell size={20} strokeWidth={1.75} />
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-coral" />
      </button>

      {/* Avatar */}
      <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-white text-xs font-bold tracking-wide hover:bg-navy-light transition-colors"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        TP
      </button>
    </header>
  )
}
