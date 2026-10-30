'use client'

// PAR-9 · Piezas compartidas de la edición de listas guardadas: el listado
// (/miembros/listas) y el detalle (/miembros/listas/[id]) ofrecen lo mismo.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/shared/Modal'
import { useToast } from '@/components/shared/Toast'
import type { MemberList } from '@/types/member-list'
import { enlaceParaEditarFiltros } from '@/lib/members/editar-lista'
import { guardarEnSesion } from '@/lib/members/filtros-en-url'

/** Abre /miembros con la búsqueda exacta de la lista, en modo «editando». */
export function useAbrirEdicionDeFiltros(): (list: Pick<MemberList, 'id' | 'filters'>) => void {
  const router = useRouter()
  return list => {
    const { href, sesion } = enlaceParaEditarFiltros(list.id, list.filters)
    if (sesion) guardarEnSesion(sesion.clave, sesion.valor)
    router.push(href)
  }
}

const ETIQUETA = 'text-[13px] uppercase tracking-widest text-navy-light/80 font-display'
const CAMPO = 'w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'

/** Renombrar, descripción y tags. No toca quién está en la lista. */
export function EditarDatosDeListaModal({ list, onClose, onSaved }: {
  list: Pick<MemberList, 'id' | 'name' | 'description' | 'tags'>
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [name, setName] = useState(list.name)
  const [desc, setDesc] = useState(list.description ?? '')
  const [tags, setTags] = useState(list.tags.join(', '))
  const [saving, setSaving] = useState(false)

  async function guardar() {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/member-lists/${list.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'datos',
          name: name.trim(),
          description: desc.trim() || null,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast(d.error ?? 'No se pudo guardar la lista. Intentá de nuevo.', 'error')
        return
      }
      onSaved()
      onClose()
    } catch {
      toast('No se pudo guardar la lista. Intentá de nuevo.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} titleId="editar-datos-lista-title" width={384}>
      <div className="p-6 space-y-4">
        <p id="editar-datos-lista-title" className="text-base font-bold text-navy font-display">
          Nombre y descripción
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="lista-nombre" className={ETIQUETA}>Nombre</label>
            <input id="lista-nombre" autoFocus className={CAMPO} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="lista-descripcion" className={ETIQUETA}>Descripción (opcional)</label>
            <input id="lista-descripcion" className={CAMPO} value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Para qué sirve esta lista..." />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="lista-tags" className={ETIQUETA}>Tags (separados por coma)</label>
            <input id="lista-tags" className={CAMPO} value={tags} onChange={e => setTags(e.target.value)}
              placeholder="donantes, heredia..." />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--outline-variant)] py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body">
            Cancelar
          </button>
          <button type="button" onClick={guardar} disabled={!name.trim() || saving}
            className="flex-1 rounded-xl bg-navy py-2.5 text-sm text-white hover:bg-navy/80 transition-colors disabled:opacity-40 font-body">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
