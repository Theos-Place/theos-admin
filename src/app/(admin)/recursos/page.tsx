'use client'

/**
 * REC-1 · Centro de recursos.
 *
 * UNA pantalla para las dos cosas. Quien consume ve solo lo publicado para su
 * perfil, que calcula el servidor. Quien gestiona (permiso `recursos`) ve
 * todo: los borradores, la audiencia de cada uno, quién lo subió, y los
 * botones para subir, editar y retirar.
 *
 * Abrir y descargar pasan SIEMPRE por /api/resources/[id]/file, que valida la
 * audiencia y redirige a una URL firmada corta. Acá no hay ningún enlace
 * directo al bucket.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, Image as ImageIcon, Upload, Pencil, Trash2, Download, ExternalLink, Search, Loader2, FolderOpen } from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { Modal } from '@/components/shared/Modal'
import { EmptyState } from '@/components/shared/EmptyState'
import { DeleteConfirmModal } from '@/components/shared/DeleteConfirmModal'
import { ActiveWarningModal } from '@/components/shared/ActiveWarningModal'
import { RestriccionDeAudiencia } from '@/components/audiencia/RestriccionDeAudiencia'
import { useToast } from '@/components/shared/Toast'
import { TIPOS_DE_AUDIENCIA_DE_RECURSOS, type Restriccion } from '@/lib/audiencia/restriccion'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Recurso } from '@/lib/supabase/queries/resources'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'
const labelCls = 'text-[11px] tracking-widest uppercase text-navy-light/80 font-display'

function tamano(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

const SIN_CATEGORIA = 'Sin categoría'

export default function RecursosPage() {
  const toast = useToast()
  const [items, setItems] = useState<Recurso[] | null>(null)
  const [gestiona, setGestiona] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState<string | null>(null)
  const [editando, setEditando] = useState<Recurso | 'nuevo' | null>(null)
  const [aviso, setAviso] = useState<Recurso | null>(null)
  const [borrando, setBorrando] = useState<Recurso | null>(null)
  const [ocupado, setOcupado] = useState(false)

  // Nace cargando (items null); el error se limpia cuando llega la respuesta,
  // no al arrancar — un setState sincrónico en el efecto es lo que LINT-1 sacó.
  const cargar = useCallback(() =>
    fetch('/api/resources')
      .then(r => (r.ok ? r.json() : Promise.reject(r)))
      .then(base => base.gestiona
        ? fetch('/api/resources?gestion=1').then(r => (r.ok ? r.json() : Promise.reject(r)))
        : base)
      .then(d => { setItems(d.items); setGestiona(!!d.gestiona); setError(null) })
      .catch(() => { setError('No se pudieron cargar los recursos. Recargá la página.'); setItems([]) }),
  [])
  useEffect(() => { void cargar() }, [cargar])

  const categorias = useMemo(
    () => [...new Set((items ?? []).map(r => r.category ?? SIN_CATEGORIA))].sort((a, b) => a.localeCompare(b, 'es')),
    [items],
  )
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return (items ?? []).filter(r =>
      (!categoria || (r.category ?? SIN_CATEGORIA) === categoria)
      && (!q || r.title.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q)))
  }, [items, busqueda, categoria])
  const hayFiltro = !!busqueda.trim() || !!categoria

  function pedirBorrado(r: Recurso) {
    // El patrón global: si está publicado, primero se avisa a quién le llega.
    if (r.publicado) setAviso(r)
    else setBorrando(r)
  }

  async function borrar() {
    if (!borrando) return
    setOcupado(true)
    try {
      const res = await fetch(`/api/resources/${borrando.id}`, { method: 'DELETE' })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error ?? 'No se pudo retirar el recurso.')
      toast('Recurso retirado', 'success')
      setBorrando(null)
      await cargar()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo retirar el recurso.', 'error')
    } finally { setOcupado(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">Recursos</h1>
          <p className="text-sm text-navy-light/80 font-body">
            {gestiona
              ? 'Manuales, guías y registros. Cada uno lo ve solo la audiencia que le pongás.'
              : 'Manuales, guías y registros para tu servicio.'}
          </p>
        </div>
        {gestiona && (
          <Button onClick={() => setEditando('nuevo')}>
            <Upload size={15} aria-hidden="true" /> Subir recurso
          </Button>
        )}
      </div>

      {(items?.length ?? 0) > 0 && (
        <div className="space-y-3">
          <div className="relative max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-light/80" aria-hidden="true" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por título…"
              aria-label="Buscar recursos por título"
              className={cn(inputCls, 'pl-9')}
            />
          </div>
          {categorias.length > 1 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoría">
              {[null, ...categorias].map(c => (
                <button
                  key={c ?? 'todas'}
                  type="button"
                  onClick={() => setCategoria(c)}
                  aria-pressed={categoria === c}
                  className={cn(
                    'rounded-full px-3.5 py-1.5 text-[13px] transition-colors font-body',
                    categoria === c ? 'bg-navy text-white' : 'bg-surface-card text-navy-light shadow-[var(--shadow-sm)] hover:bg-surface-low',
                  )}
                >
                  {c ?? 'Todas'}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-[13px] text-coral-deep font-body" role="alert">{error}</p>}

      {items === null ? (
        <div className="flex items-center gap-2 text-sm text-navy-light/80 font-body">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Cargando recursos…
        </div>
      ) : visibles.length === 0 ? (
        <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)]">
          <EmptyState
            icon={FolderOpen}
            title={hayFiltro ? 'No hay recursos con ese filtro' : gestiona ? 'Todavía no hay recursos' : 'Todavía no hay recursos para vos'}
            description={hayFiltro
              ? undefined
              : gestiona
                ? 'Subí el primero. Hasta que le pongás una audiencia, solo lo ve quien gestiona recursos.'
                : 'Cuando haya manuales o guías para tu servicio, van a aparecer acá.'}
            onLimpiarFiltros={hayFiltro ? () => { setBusqueda(''); setCategoria(null) } : undefined}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map(r => (
            <TarjetaDeRecurso
              key={r.id}
              r={r}
              gestiona={gestiona}
              onEditar={() => setEditando(r)}
              onBorrar={() => pedirBorrado(r)}
            />
          ))}
        </div>
      )}

      {editando && (
        <EditorDeRecurso
          recurso={editando === 'nuevo' ? null : editando}
          categorias={categorias.filter(c => c !== SIN_CATEGORIA)}
          onCerrar={() => setEditando(null)}
          onGuardado={async () => { setEditando(null); await cargar() }}
        />
      )}

      <ActiveWarningModal
        open={!!aviso}
        title="Este recurso está publicado"
        message={aviso
          ? `Hoy lo ve: ${aviso.audiencia_resumen || 'su audiencia'}. Si lo retirás, deja de estar disponible para todas esas personas.`
          : ''}
        onClose={() => { const r = aviso; setAviso(null); if (r) setBorrando(r) }}
      />
      <DeleteConfirmModal
        open={!!borrando}
        title="Retirar recurso"
        description={borrando ? `Se borra «${borrando.title}» y su archivo. No se puede deshacer.` : ''}
        onConfirm={borrar}
        onCancel={() => setBorrando(null)}
        loading={ocupado}
        confirmLabel="Retirar"
      />
    </div>
  )
}

function TarjetaDeRecurso({ r, gestiona, onEditar, onBorrar }: {
  r: Recurso; gestiona: boolean; onEditar: () => void; onBorrar: () => void
}) {
  const esPdf = r.mime_type === 'application/pdf'
  const Icono = esPdf ? FileText : ImageIcon
  return (
    <article className="flex flex-col rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-soft/30 text-teal-ink">
          <Icono size={19} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold leading-snug text-navy font-display break-words">{r.title}</h2>
          <p className="mt-0.5 text-[13px] text-navy-light/80 font-body">
            {(r.category ?? SIN_CATEGORIA)} · {esPdf ? 'PDF' : 'Imagen'} · {tamano(r.size_bytes)}
          </p>
        </div>
      </div>

      {r.description && <p className="mt-3 text-sm text-navy-light font-body whitespace-pre-line">{r.description}</p>}

      {gestiona && (
        <div className="mt-3 space-y-1 rounded-xl bg-surface-low px-3 py-2.5">
          <p className={cn('text-[13px] font-semibold font-body', r.publicado ? 'text-teal-ink' : 'text-coral-deep')}>
            {r.publicado ? 'Publicado' : 'Sin publicar'}
          </p>
          <p className="text-[13px] text-navy-light/80 font-body">
            {r.publicado ? `Lo ve: ${r.audiencia_resumen}` : 'Solo lo ve quien gestiona recursos. Ponele una audiencia para publicarlo.'}
          </p>
          <p className="text-[13px] text-navy-light/80 font-body">
            Subido por {r.subido_por ?? 'alguien que ya no figura'} el {formatDate(r.created_at)}
          </p>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        <Button href={`/api/resources/${r.id}/file`} target="_blank" rel="noopener noreferrer" tamano="sm" variante="navy">
          <ExternalLink size={14} aria-hidden="true" /> Abrir
        </Button>
        <Button href={`/api/resources/${r.id}/file?descargar=1`} tamano="sm" variante="secundario">
          <Download size={14} aria-hidden="true" /> Descargar
        </Button>
        {gestiona && (
          <span className="ml-auto flex gap-1">
            <button type="button" onClick={onEditar} aria-label={`Editar ${r.title}`}
              className="flex h-11 w-11 items-center justify-center rounded-full text-navy-light hover:bg-surface-low hover:text-navy">
              <Pencil size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={onBorrar} aria-label={`Retirar ${r.title}`}
              className="flex h-11 w-11 items-center justify-center rounded-full text-navy-light hover:bg-coral/10 hover:text-coral-deep">
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </span>
        )}
      </div>
    </article>
  )
}

function EditorDeRecurso({ recurso, categorias, onCerrar, onGuardado }: {
  recurso: Recurso | null
  categorias: string[]
  onCerrar: () => void
  onGuardado: () => void | Promise<void>
}) {
  const toast = useToast()
  const nuevo = !recurso
  const [title, setTitle] = useState(recurso?.title ?? '')
  const [description, setDescription] = useState(recurso?.description ?? '')
  const [category, setCategory] = useState(recurso?.category ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [audiencia, setAudiencia] = useState<Restriccion | null>((recurso?.audience as Restriccion | null) ?? null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const listo = title.trim().length > 0 && (!nuevo || !!file)

  async function guardar() {
    if (!listo || guardando) return
    setGuardando(true); setError(null)
    try {
      let res: Response
      if (nuevo) {
        const fd = new FormData()
        fd.append('file', file!)
        fd.append('title', title.trim())
        fd.append('description', description.trim())
        fd.append('category', category.trim())
        if (audiencia) fd.append('audience', JSON.stringify(audiencia))
        res = await fetch('/api/resources', { method: 'POST', body: fd })
      } else {
        res = await fetch(`/api/resources/${recurso!.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title.trim(), description: description.trim() || null, category: category.trim() || null, audience: audiencia }),
        })
      }
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error ?? 'No se pudo guardar.')
      toast(nuevo ? 'Recurso subido' : 'Cambios guardados', 'success')
      await onGuardado()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
      setGuardando(false)
    }
  }

  return (
    <Modal onClose={() => { if (!guardando) onCerrar() }} titleId="recurso-editor-title" width={640}>
      <div className="space-y-4 p-6">
        <h2 id="recurso-editor-title" className="text-lg font-semibold text-navy font-display">
          {nuevo ? 'Subir recurso' : 'Editar recurso'}
        </h2>

        {nuevo && (
          <div className="space-y-1">
            <label htmlFor="recurso-archivo" className={labelCls}>Archivo (PDF o imagen, hasta 15 MB)</label>
            <input
              id="recurso-archivo"
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={e => {
                const f = e.target.files?.[0] ?? null
                setFile(f)
                if (f && !title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ''))
              }}
              className="w-full text-[13px] text-navy-light/80 font-body file:mr-3 file:rounded-full file:border-0 file:bg-surface-low file:px-3 file:py-1.5 file:text-[13px] file:text-navy"
            />
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="recurso-titulo" className={labelCls}>Título</label>
          <input id="recurso-titulo" value={title} onChange={e => setTitle(e.target.value)} maxLength={200} className={inputCls} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="recurso-categoria" className={labelCls}>Categoría</label>
            <input id="recurso-categoria" value={category} onChange={e => setCategory(e.target.value)} maxLength={80}
              list="recurso-categorias" placeholder="Ej. Manuales" className={inputCls} />
            <datalist id="recurso-categorias">
              {categorias.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="recurso-descripcion" className={labelCls}>Descripción (opcional)</label>
          <textarea id="recurso-descripcion" value={description} onChange={e => setDescription(e.target.value)}
            maxLength={2000} rows={3} className={inputCls} />
        </div>

        <RestriccionDeAudiencia
          value={audiencia}
          onChange={setAudiencia}
          defaultOpen={!!audiencia}
          titulo="Quién lo ve"
          sinRestriccion="Sin publicar: solo lo ve quien gestiona recursos"
          explicacion={<>Elegí por <strong>rol</strong> (pestaña Perfil), por <strong>puesto</strong> de servicio, o combiná los dos. Se calcula cada vez que alguien abre la biblioteca: quien deja un puesto deja de verlo solo.</>}
          avisoNadie="Así como está, no lo vería nadie."
          tipos={TIPOS_DE_AUDIENCIA_DE_RECURSOS}
          contexto="recursos"
        />

        {error && <p className="text-[13px] text-coral-deep font-body" role="alert">{error}</p>}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button variante="secundario" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
          <Button onClick={guardar} disabled={!listo || guardando}>
            {guardando ? <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> Guardando…</> : nuevo ? 'Subir' : 'Guardar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
