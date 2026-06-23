'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { MemberList } from '@/types/member-list'
import { DeleteConfirmModal } from '@/components/shared/DeleteConfirmModal'
import { cn } from '@/lib/utils'
import {
  Bookmark, MessageCircle, MoreHorizontal, Users, Plus, Search, ChevronLeft,
  Edit2, RefreshCw, Trash2,
} from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { Modal } from '@/components/shared/Modal'
import { useToast } from '@/components/shared/Toast'

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
  const toast = useToast()

  const [lists, setLists]         = useState<MemberList[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [openMenu, setOpenMenu]   = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<string | null>(null)
  const [editName, setEditName]   = useState('')
  const [editTags, setEditTags]   = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  async function loadLists() {
    try {
      const res = await fetch('/api/member-lists')
      if (res.ok) setLists(await res.json())
      else toast('No se pudieron cargar las listas.', 'error')
    } catch (err) {
      console.error('No se pudieron cargar las listas:', err)
      toast('No se pudieron cargar las listas.', 'error')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { loadLists() }, [])

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

  function requestDelete(id: string, name: string) {
    setOpenMenu(null)
    setDeleteTarget({ id, name })
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/member-lists/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      await loadLists()
    } catch (err) {
      console.error('No se pudo eliminar la lista:', err)
      toast('No se pudo eliminar la lista. Intentá de nuevo.', 'error')
    }
    setDeleteTarget(null)
  }

  async function handleRefresh(id: string) {
    setOpenMenu(null)
    try {
      const res = await fetch(`/api/member-lists/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ last_used_at: new Date().toISOString() }),
      })
      if (!res.ok) throw new Error()
      await loadLists()
    } catch (err) {
      console.error('No se pudo actualizar la lista:', err)
      toast('No se pudo actualizar la lista.', 'error')
    }
  }

  function openEdit(id: string) {
    const list = lists.find(l => l.id === id)
    if (!list) return
    setEditName(list.name)
    setEditTags(list.tags.join(', '))
    setEditTarget(id)
    setOpenMenu(null)
  }

  async function saveEdit() {
    if (!editTarget || !editName.trim()) return
    const tags = editTags.split(',').map(t => t.trim()).filter(Boolean)
    try {
      const res = await fetch(`/api/member-lists/${editTarget}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), tags }),
      })
      if (!res.ok) throw new Error()
      await loadLists()
    } catch (err) {
      console.error('No se pudo guardar la lista:', err)
      toast('No se pudo guardar la lista. Intentá de nuevo.', 'error')
    }
    setEditTarget(null)
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/miembros"
            className="inline-flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors mb-1 font-body"
          >
            <ChevronLeft size={14} />
            Miembros
          </Link>
          <h1
            className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]"
          >
            Listas guardadas
          </h1>
          <p className="mt-1 text-sm text-navy-light/60 font-body">
            {loading ? '—' : lists.length} lista{lists.length !== 1 ? 's' : ''} · Segmentos para comunicaciones y reportes
          </p>
        </div>
        <Link
          href="/miembros"
          className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-all shrink-0 font-body"
        >
          <Plus size={14} />
          Nueva lista
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 rounded-xl bg-surface-low px-3 py-2 w-full sm:w-56 focus-within:ring-1 focus-within:ring-coral/30 transition-all">
          <Search size={14} className="text-navy-light/60 shrink-0" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar lista..."
            aria-label="Buscar lista"
            className="flex-1 bg-transparent text-sm text-navy placeholder-navy-light/50 outline-none font-body"
          />
        </div>
        <button
          onClick={() => setActiveTag(null)}
          className={cn(
            'rounded-full px-3.5 py-1.5 text-[12px] font-medium border transition-all font-display',
            !activeTag ? 'bg-navy text-white border-navy' : 'text-navy-light/60 hover:text-navy border-transparent'
          )}
        >
          Todas
        </button>
        {allTags.map(tag => (
          <button
            key={tag}
            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-[12px] font-medium border transition-all font-display',
              activeTag === tag ? 'bg-navy text-white border-navy' : 'text-navy-light/60 hover:text-navy border-transparent'
            )}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] py-16 text-center">
          <p className="text-sm text-navy-light/60 font-body">Cargando listas…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)]">
          <EmptyState
            icon={Bookmark}
            title="No hay listas guardadas aún"
            description="Creá tu primera lista desde la página de miembros aplicando filtros."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(list => (
            <div
              key={list.id}
              className="rounded-2xl p-5 space-y-4 relative bg-surface-card shadow-[var(--shadow-md)]"
            >
              {/* Card header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-[rgba(22,20,64,0.07)]"
                  >
                    <Bookmark size={16} className="text-navy" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-navy leading-snug font-display">
                      {list.name}
                    </p>
                    <p className="text-[11px] text-navy-light/60 mt-0.5 font-body">
                      {list.member_count.toLocaleString('es-CR')} miembros
                    </p>
                  </div>
                </div>

                {/* Menu */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => setOpenMenu(openMenu === list.id ? null : list.id)}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-navy-light/60 hover:bg-surface-low hover:text-navy transition-colors"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  {openMenu === list.id && (
                    <div
                      className="absolute right-0 top-8 z-20 w-44 rounded-xl overflow-hidden bg-surface-card shadow-[0_8px_32px_rgba(22,20,64,0.16)] border border-[var(--outline-variant)]"
                    >
                      <button
                        onClick={() => openEdit(list.id)}
                        className="flex items-center gap-2 w-full px-3 py-2.5 text-[13px] text-navy hover:bg-surface-low transition-colors font-body"
                      >
                        <Edit2 size={13} /> Editar nombre/tags
                      </button>
                      {!list.is_dynamic && (
                        <button
                          onClick={() => handleRefresh(list.id)}
                          className="flex items-center gap-2 w-full px-3 py-2.5 text-[13px] text-navy hover:bg-surface-low transition-colors font-body"
                        >
                          <RefreshCw size={13} /> Actualizar snapshot
                        </button>
                      )}
                      <button
                        onClick={() => requestDelete(list.id, list.name)}
                        className="flex items-center gap-2 w-full px-3 py-2.5 text-[13px] text-coral hover:bg-coral/5 transition-colors font-body"
                      >
                        <Trash2 size={13} /> Eliminar
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Segment label */}
              <div
                className="rounded-lg px-3 py-2 text-[12px] text-navy-light/60 bg-surface-low font-mono"
              >
                {list.segment_label}
              </div>

              {/* Type badge + tags */}
              <div className="flex flex-wrap gap-1.5">
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-[10px] font-semibold font-display',
                    list.is_dynamic ? 'bg-teal-soft/30 text-teal-deep' : 'bg-navy-light/10 text-navy-light/60'
                  )}
                >
                  {list.is_dynamic ? 'Dinámica' : 'Snapshot'}
                </span>
                {list.tags.map(tag => (
                  <span
                    key={tag}
                    className="rounded-full bg-surface-low px-2.5 py-0.5 text-[10px] text-navy-light/60 font-body border-[0.5px] border-[var(--outline-variant)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Meta */}
              <p className="text-[11px] text-navy-light/60 font-body">
                Creada por {list.created_by} · {new Date(list.created_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}
                {list.last_used_at && ` · Último uso: ${timeAgo(list.last_used_at)}`}
              </p>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1 border-t border-[var(--outline-variant)]">
                <button
                  onClick={() => handleComunicar(list.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-coral/10 py-1.5 text-[12px] font-medium text-coral hover:bg-coral/20 transition-colors font-body"
                >
                  <MessageCircle size={13} />
                  Comunicar
                </button>
                <Link
                  href={`/miembros/listas/${list.id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-[var(--outline-variant)] py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors font-body"
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
        <Modal onClose={() => setEditTarget(null)} titleId="editar-lista-title" width={384}>
          <div className="p-6 space-y-4">
            <p id="editar-lista-title" className="text-base font-bold text-navy font-display">
              Editar lista
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-navy-light/60 font-display">
                  Nombre
                </label>
                <input
                  autoFocus
                  className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-navy-light/60 font-display">
                  Tags (separados por coma)
                </label>
                <input
                  className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
                  value={editTags}
                  onChange={e => setEditTags(e.target.value)}
                  placeholder="donadores, heredia..."
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditTarget(null)}
                className="flex-1 rounded-xl border border-[var(--outline-variant)] py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
              >
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                disabled={!editName.trim()}
                className="flex-1 rounded-xl bg-navy py-2.5 text-sm text-white hover:bg-navy/80 transition-colors disabled:opacity-40 font-body"
              >
                Guardar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Overlay para cerrar menú */}
      {openMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
      )}

      <DeleteConfirmModal
        open={!!deleteTarget}
        title="Eliminar lista"
        description={`Se eliminará la lista "${deleteTarget?.name ?? ''}". Esta acción no se puede deshacer.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
