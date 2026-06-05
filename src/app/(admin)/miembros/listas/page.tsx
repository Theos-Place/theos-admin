'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { listStore } from '@/data/mock-member-lists'
import { cn } from '@/lib/utils'
import {
  Bookmark, MessageCircle, MoreHorizontal, Users, Plus, Search, ChevronLeft,
  Edit2, RefreshCw, Trash2, X,
} from 'lucide-react'

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Nunca'
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} días`
  const weeks = Math.floor(days / 7)
  if (weeks === 1) return 'hace 1 semana'
  if (weeks < 5) return `hace ${weeks} semanas`
  return new Date(dateStr).toLocaleDateString('es-CR', { day: 'numeric', month: 'short' })
}

export default function ListasGuardadasPage() {
  const router = useRouter()

  const [lists, setLists]         = useState(() => listStore.getAll())
  const [search, setSearch]       = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [openMenu, setOpenMenu]   = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<string | null>(null)
  const [editName, setEditName]   = useState('')
  const [editTags, setEditTags]   = useState('')

  const allTags = Array.from(new Set(lists.flatMap(l => l.tags))).sort()

  const filtered = lists.filter(list => {
    const matchSearch = !search || list.name.toLowerCase().includes(search.toLowerCase())
    const matchTag    = !activeTag || list.tags.includes(activeTag)
    return matchSearch && matchTag
  })

  function handleComunicar(listId: string) {
    const list = lists.find(l => l.id === listId)
    if (!list) return
    const ids   = list.member_ids.join(',')
    const label = encodeURIComponent(list.name)
    router.push(`/comunicaciones/nueva?mode=manual&members=${ids}&segment_label=${label}&list_id=${list.id}`)
  }

  function handleDelete(id: string) {
    listStore.remove(id)
    setLists(listStore.getAll())
    setOpenMenu(null)
  }

  function handleRefresh(id: string) {
    listStore.update(id, { updated_at: new Date().toISOString() })
    setLists(listStore.getAll())
    setOpenMenu(null)
  }

  function openEdit(id: string) {
    const list = lists.find(l => l.id === id)
    if (!list) return
    setEditName(list.name)
    setEditTags(list.tags.join(', '))
    setEditTarget(id)
    setOpenMenu(null)
  }

  function saveEdit() {
    if (!editTarget || !editName.trim()) return
    const tags = editTags.split(',').map(t => t.trim()).filter(Boolean)
    listStore.update(editTarget, { name: editName.trim(), tags, updated_at: new Date().toISOString() })
    setLists(listStore.getAll())
    setEditTarget(null)
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/miembros"
            className="inline-flex items-center gap-1 text-sm text-navy-light/50 hover:text-navy transition-colors mb-1"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <ChevronLeft size={14} />
            Miembros
          </Link>
          <h1
            className="text-2xl text-navy"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            Listas guardadas
          </h1>
          <p className="mt-1 text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
            {lists.length} lista{lists.length !== 1 ? 's' : ''} · Segmentos para comunicaciones y reportes
          </p>
        </div>
        <Link
          href="/miembros"
          className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-all shrink-0"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          <Plus size={14} />
          Nueva lista
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 rounded-xl bg-surface-low px-3 py-2 w-full sm:w-56 focus-within:ring-1 focus-within:ring-coral/30 transition-all">
          <Search size={14} className="text-navy-light/40 shrink-0" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar lista..."
            className="flex-1 bg-transparent text-sm text-navy placeholder-navy-light/40 outline-none"
            style={{ fontFamily: 'var(--font-body)' }}
          />
        </div>
        <button
          onClick={() => setActiveTag(null)}
          className={cn(
            'rounded-full px-3.5 py-1.5 text-[12px] font-medium border transition-all',
            !activeTag ? 'bg-navy text-white border-navy' : 'text-navy-light/60 hover:text-navy border-transparent'
          )}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Todas
        </button>
        {allTags.map(tag => (
          <button
            key={tag}
            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-[12px] font-medium border transition-all',
              activeTag === tag ? 'bg-navy text-white border-navy' : 'text-navy-light/60 hover:text-navy border-transparent'
            )}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
        >
          <Bookmark size={28} className="text-navy-light/20 mx-auto mb-3" />
          <p className="text-sm font-semibold text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
            No hay listas guardadas aún
          </p>
          <p className="text-[13px] text-navy-light/40 mt-1" style={{ fontFamily: 'var(--font-body)' }}>
            Creá tu primera lista desde la página de miembros aplicando filtros.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(list => (
            <div
              key={list.id}
              className="rounded-2xl p-5 space-y-4 relative"
              style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
            >
              {/* Card header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(22,20,64,0.07)' }}
                  >
                    <Bookmark size={16} className="text-navy" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-navy leading-snug" style={{ fontFamily: 'var(--font-display)' }}>
                      {list.name}
                    </p>
                    <p className="text-[11px] text-navy-light/50 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
                      {list.member_count.toLocaleString('es-CR')} miembros
                    </p>
                  </div>
                </div>

                {/* Menu */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => setOpenMenu(openMenu === list.id ? null : list.id)}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-navy-light/40 hover:bg-surface-low hover:text-navy transition-colors"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  {openMenu === list.id && (
                    <div
                      className="absolute right-0 top-8 z-20 w-44 rounded-xl overflow-hidden"
                      style={{ background: 'var(--surface-card)', boxShadow: '0 8px 32px rgba(22,20,64,0.16)', border: '1px solid var(--outline-variant)' }}
                    >
                      <button
                        onClick={() => openEdit(list.id)}
                        className="flex items-center gap-2 w-full px-3 py-2.5 text-[13px] text-navy hover:bg-surface-low transition-colors"
                        style={{ fontFamily: 'var(--font-body)' }}
                      >
                        <Edit2 size={13} /> Editar nombre/tags
                      </button>
                      {!list.is_dynamic && (
                        <button
                          onClick={() => handleRefresh(list.id)}
                          className="flex items-center gap-2 w-full px-3 py-2.5 text-[13px] text-navy hover:bg-surface-low transition-colors"
                          style={{ fontFamily: 'var(--font-body)' }}
                        >
                          <RefreshCw size={13} /> Actualizar snapshot
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(list.id)}
                        className="flex items-center gap-2 w-full px-3 py-2.5 text-[13px] text-coral hover:bg-coral/5 transition-colors"
                        style={{ fontFamily: 'var(--font-body)' }}
                      >
                        <Trash2 size={13} /> Eliminar
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Segment label */}
              <div
                className="rounded-lg px-3 py-2 text-[12px] text-navy-light/60"
                style={{ background: 'var(--surface-low)', fontFamily: 'var(--font-mono)' }}
              >
                {list.segment_label}
              </div>

              {/* Type badge + tags */}
              <div className="flex flex-wrap gap-1.5">
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-[10px] font-semibold',
                    list.is_dynamic ? 'bg-teal-soft/30 text-teal-deep' : 'bg-navy-light/10 text-navy-light/60'
                  )}
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {list.is_dynamic ? 'Dinámica' : 'Snapshot'}
                </span>
                {list.tags.map(tag => (
                  <span
                    key={tag}
                    className="rounded-full bg-surface-low px-2.5 py-0.5 text-[10px] text-navy-light/50"
                    style={{ fontFamily: 'var(--font-body)', border: '0.5px solid var(--outline-variant)' }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Meta */}
              <p className="text-[11px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
                Creada por {list.created_by} · {new Date(list.created_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}
                {list.last_used_at && ` · Último uso: ${timeAgo(list.last_used_at)}`}
              </p>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1" style={{ borderTop: '1px solid var(--outline-variant)' }}>
                <button
                  onClick={() => handleComunicar(list.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-coral/10 py-1.5 text-[12px] font-medium text-coral hover:bg-coral/20 transition-colors"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  <MessageCircle size={13} />
                  Comunicar
                </button>
                <Link
                  href={`/miembros/listas/${list.id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
                  style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                >
                  <Users size={13} />
                  Ver lista
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-ink/60 backdrop-blur-sm">
          <div
            className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
          >
            <div className="flex items-center justify-between">
              <p className="text-base font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
                Editar lista
              </p>
              <button onClick={() => setEditTarget(null)}>
                <X size={18} className="text-navy-light/40" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                  Nombre
                </label>
                <input
                  autoFocus
                  className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30"
                  style={{ fontFamily: 'var(--font-body)' }}
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                  Tags (separados por coma)
                </label>
                <input
                  className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30"
                  style={{ fontFamily: 'var(--font-body)' }}
                  value={editTags}
                  onChange={e => setEditTags(e.target.value)}
                  placeholder="donadores, heredia..."
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditTarget(null)}
                className="flex-1 rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors"
                style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
              >
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                disabled={!editName.trim()}
                className="flex-1 rounded-xl bg-navy py-2.5 text-sm text-white hover:bg-navy/80 transition-colors disabled:opacity-40"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay para cerrar menú */}
      {openMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
      )}
    </div>
  )
}
