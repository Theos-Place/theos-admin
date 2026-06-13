'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Menu, Search, User, Settings, LogOut, ChevronDown, Shield, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { ROLES } from '@/lib/auth/roles'
import { NotificationsBell } from './NotificationsDropdown'
import { getInitials } from '@/lib/format'

interface TopbarProps {
  title: string
  onMenuToggle: () => void
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

  const userInitials = user ? getInitials(user.name) : 'TP'

  const roleLabel = useMemo(
    () => user?.roles?.map(rid => ROLES.find(r => r.id === rid)?.name).filter(Boolean).join(' · ') ?? '',
    [user?.roles],
  )

  return (
    <header
      className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b px-4 lg:px-6 bg-[var(--glass-bg)] [backdrop-filter:var(--glass-blur)] border-[var(--outline-variant)]"
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
        className="text-lg text-navy shrink-0 font-display font-extrabold tracking-[-0.01em]"
      >
        {title}
      </h1>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search global de miembros */}
      <GlobalMemberSearch />

      {/* Notifications */}
      <NotificationsBell />

      {/* Avatar + dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          aria-label="Menú de usuario"
          aria-expanded={menuOpen}
          className="flex items-center gap-1.5 rounded-full hover:bg-surface-low transition-colors pl-1 pr-1 py-1"
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-white text-xs font-bold tracking-wide font-display"
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
            className="absolute right-0 top-[calc(100%+8px)] w-64 rounded-2xl overflow-hidden bg-surface-card shadow-[0_20px_48px_rgba(22,20,64,0.14)] border border-[var(--outline-variant)] z-50"
          >
            {/* User info */}
            <div
              className="px-4 py-3.5 border-b border-[var(--outline-variant)]"
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold text-white bg-navy font-display"
                >
                  {userInitials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy truncate font-body">
                    {user?.name ?? 'Usuario'}
                  </p>
                  <p className="text-[11px] text-navy-light/50 truncate font-body">
                    {user?.email ?? ''}
                  </p>
                  {roleLabel && (
                    <p className="text-[11px] text-teal-deep mt-0.5 truncate font-body">
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
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
              >
                <User size={15} className="text-navy-light/50 shrink-0" />
                Mi perfil
              </Link>
              <Link
                href="/configuracion"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
              >
                <Settings size={15} className="text-navy-light/50 shrink-0" />
                Configuración
              </Link>
              <Link
                href="/configuracion/seguridad"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
              >
                <Shield size={15} className="text-navy-light/50 shrink-0" />
                Seguridad
              </Link>
            </div>

            <div className="border-t py-1.5 border-[var(--outline-variant)]">
              <button
                onClick={() => { setMenuOpen(false); handleLogout() }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-coral hover:bg-coral/5 transition-colors font-body"
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

/* ── Search global de miembros (server-side: nombre, cédula, correo) ── */
type SearchResult = { id: string; first_name: string; last_name: string; cedula: string | null }

function resultInitials(m: SearchResult) {
  return ((m.first_name[0] ?? '') + (m.last_name[0] ?? '')).toUpperCase() || '—'
}

function GlobalMemberSearch() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  // Debounce de 300ms; mínimo 2 caracteres.
  useEffect(() => {
    let alive = true
    const t = setTimeout(() => {
      const term = q.trim()
      if (term.length < 2) { if (alive) { setResults([]); setOpen(false) } return }
      setSearching(true)
      setOpen(true)
      fetch(`/api/members?search=${encodeURIComponent(term)}&pageSize=8`)
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (alive) { setResults(d?.members ?? []); setSearching(false) } })
        .catch(() => { if (alive) { setResults([]); setSearching(false) } })
    }, 300)
    return () => { alive = false; clearTimeout(t) }
  }, [q])

  // Cerrar con clic fuera.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  function go(id: string) {
    setOpen(false)
    setQ('')
    setResults([])
    router.push(`/miembros/${id}`)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'Enter' && results[0]) { e.preventDefault(); go(results[0].id) }
  }

  return (
    <div className="relative hidden sm:block" ref={boxRef}>
      <div className="flex items-center gap-2 rounded-xl bg-surface-low px-3 py-2 w-56 lg:w-72 transition-all focus-within:ring-1 focus-within:ring-coral/30">
        <Search size={16} className="text-navy-light/50 shrink-0" strokeWidth={1.75} />
        <input
          type="search"
          aria-label="Buscar miembro por nombre, cédula o correo"
          placeholder="Buscar miembro por nombre, cédula o correo..."
          value={q}
          onChange={e => setQ(e.target.value)}
          onFocus={() => { if (results.length || searching) setOpen(true) }}
          onKeyDown={onKeyDown}
          className="flex-1 bg-transparent text-sm text-navy placeholder-navy-light/50 outline-none font-body font-light"
        />
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-2xl overflow-hidden bg-surface-card shadow-card-lg border border-outline">
          {searching ? (
            <div className="flex items-center justify-center gap-2 px-4 py-4 text-[13px] text-navy-light/60 font-body">
              <Loader2 size={14} className="animate-spin" /> Buscando…
            </div>
          ) : results.length === 0 ? (
            <p className="px-4 py-4 text-center text-[13px] text-navy-light/60 font-body">
              No se encontraron miembros
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map(m => (
                <li key={m.id}>
                  <button
                    onClick={() => go(m.id)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-low transition-colors"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy text-[10px] font-display font-extrabold">
                      {resultInitials(m)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-navy font-body">{m.first_name} {m.last_name}</span>
                      {m.cedula && <span className="text-[11px] text-navy-light/60 font-mono">{m.cedula}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
