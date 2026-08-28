'use client'

import { useRef, useState } from 'react'
import { Image as ImageIcon, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Campo de imagen de un formulario (pensado para comprobantes).
 *
 * El valor que viaja es el PATH del bucket privado, no una URL: el archivo se
 * sirve firmado por /api/forms/attachment (ver lib/forms/attachment.ts).
 *
 * La subida ocurre al elegir el archivo y no al enviar el formulario. Así, si
 * la imagen es pesada o la conexión mala, la persona lo ve enseguida y no
 * después de llenar todo — y el envío queda instantáneo.
 */
export function ImageAnswerField({ value, onChange, controlId }: {
  value: string
  onChange: (path: string) => void
  controlId: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nombre, setNombre] = useState<string | null>(null)

  async function subir(file: File) {
    setError(null)
    setSubiendo(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/forms/upload-attachment', { method: 'POST', body: fd })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.path) { setError(d.error ?? 'No se pudo subir la imagen.'); return }
      setNombre(file.name)
      onChange(d.path)
    } catch {
      setError('No se pudo subir la imagen. Revisá tu conexión.')
    } finally { setSubiendo(false) }
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-surface-low px-3 py-2.5">
        <ImageIcon size={15} className="text-teal-deep shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm text-navy font-body">
          {nombre ?? 'Imagen adjunta'}
        </span>
        <button
          type="button"
          onClick={() => { onChange(''); setNombre(null); if (input.current) input.current.value = '' }}
          aria-label="Quitar la imagen"
          className="shrink-0 rounded-lg p-1 text-navy-light hover:bg-surface-card transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <input
        ref={input}
        id={controlId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={subiendo}
        onChange={e => { const f = e.target.files?.[0]; if (f) subir(f) }}
        className={cn(
          'block w-full text-sm text-navy-light font-body',
          'file:mr-3 file:rounded-lg file:border-0 file:bg-navy file:px-3 file:py-1.5',
          'file:text-[13px] file:text-white file:cursor-pointer hover:file:bg-navy/90',
          subiendo && 'opacity-60',
        )}
      />
      {subiendo && (
        <p className="flex items-center gap-1.5 text-[13px] text-navy-light/80 font-body">
          <Loader2 size={13} className="animate-spin" aria-hidden /> Subiendo…
        </p>
      )}
      {error && <p className="text-[13px] text-coral-deep font-body">{error}</p>}
      {!subiendo && !error && (
        <p className="text-[13px] text-navy-light/80 font-body">JPG, PNG o WEBP, hasta 5 MB.</p>
      )}
    </div>
  )
}
