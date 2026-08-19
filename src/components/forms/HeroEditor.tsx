'use client'

// FRM-2 · "Encabezado (opcional)" del builder de formularios.
//
// Sube el flyer a Storage (bucket form-heroes) y devuelve la URL: la imagen
// NUNCA se guarda como base64 en la columna — ese fue el problema que EVE-2 vino
// a arreglar en eventos. Se puede quitar en cualquier momento.
import { useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { FormHero, hasHero, type FormHeroData } from '@/components/forms/FormHero'
import { HERO_ALLOWED, HERO_MAX_BYTES } from '@/lib/forms/hero-upload'
import { cn } from '@/lib/utils'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'

export function HeroEditor({ value, onChange, formName }: {
  value: FormHeroData
  onChange: (patch: Partial<FormHeroData>) => void
  /** Nombre del formulario: es el título que se usa si no se pone uno propio. */
  formName?: string
}) {
  const [open, setOpen] = useState(hasHero(value))
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function subir(file: File) {
    setError(null)
    if (!(HERO_ALLOWED as readonly string[]).includes(file.type)) {
      setError('Formato no permitido. Usá JPG, PNG o WEBP.')
      return
    }
    if (file.size > HERO_MAX_BYTES) {
      setError('La imagen supera el máximo de 5 MB.')
      return
    }
    setSubiendo(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/forms/upload-hero', { method: 'POST', body: fd })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.url) throw new Error(data?.error || 'No se pudo subir la imagen')
      onChange({ hero_image_url: data.url })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir la imagen')
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-low transition-colors"
      >
        <span>
          <span className="text-sm text-navy font-display">Encabezado (opcional)</span>
          <span className="block text-[13px] text-navy-light/80 font-body mt-0.5">
            {hasHero(value)
              ? 'El formulario abre con esta portada.'
              : 'Agregale un flyer y una bienvenida para que se vea como una pieza de comunicación.'}
          </span>
        </span>
        {open ? <ChevronUp size={16} className="text-navy-light/80 shrink-0" /> : <ChevronDown size={16} className="text-navy-light/80 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Imagen */}
          {value.hero_image_url ? (
            <div className="space-y-2">
              <div className="rounded-xl overflow-hidden border border-[var(--outline-variant)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={value.hero_image_url} alt="Vista previa del encabezado" className="block w-full h-auto" />
              </div>
              <button
                type="button"
                onClick={() => onChange({ hero_image_url: null })}
                className="inline-flex items-center gap-1 text-[13px] text-coral hover:underline font-body"
              >
                <Trash2 size={12} /> Quitar imagen
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={subiendo}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault()
                const f = e.dataTransfer.files?.[0]
                if (f) void subir(f)
              }}
              className={cn(
                'w-full flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed py-8 transition-colors',
                'border-[var(--outline-variant)] text-navy-light/80 hover:bg-surface-low disabled:opacity-50',
              )}
            >
              {subiendo
                ? <><Loader2 size={18} className="animate-spin" /><span className="text-[13px] font-body">Subiendo…</span></>
                : <>
                    <ImagePlus size={18} />
                    <span className="text-[13px] font-body">Arrastrá el flyer o hacé clic para elegirlo</span>
                    <span className="text-[13px] text-navy-light/80 font-body">JPG, PNG o WEBP · hasta 5 MB</span>
                  </>}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              e.target.value = ''   // permite volver a elegir el mismo archivo
              if (f) void subir(f)
            }}
          />
          {error && <p className="text-[13px] text-coral font-body">{error}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[13px] text-navy-light/80 font-body mb-1 block" htmlFor="hero-title">Título</label>
              <input
                id="hero-title"
                className={inputCls}
                placeholder={formName || 'Título del encabezado'}
                value={value.hero_title ?? ''}
                onChange={e => onChange({ hero_title: e.target.value })}
              />
              <p className="mt-1 text-[13px] text-navy-light/80 font-body">Vacío = se usa el nombre del formulario.</p>
            </div>
            <div>
              <label className="text-[13px] text-navy-light/80 font-body mb-1 block" htmlFor="hero-subtitle">Bienvenida</label>
              <textarea
                id="hero-subtitle"
                rows={3}
                className={cn(inputCls, 'resize-y')}
                placeholder="Un párrafo corto de bienvenida (opcional)"
                value={value.hero_subtitle ?? ''}
                onChange={e => onChange({ hero_subtitle: e.target.value })}
              />
            </div>
          </div>

          {hasHero(value) && (
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display">Así se va a ver</p>
              <div className="mx-auto max-w-sm rounded-2xl overflow-hidden bg-surface-card border border-[var(--outline-variant)] pb-4">
                <FormHero hero={value} fallbackTitle={formName} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
