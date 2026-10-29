'use client'

/**
 * COM-5 · «Imágenes de esta plantilla»: una tarjeta por ranura marcada con
 * data-imagen-slot, con vista previa y «Cambiar imagen». Sube la nueva al
 * mismo bucket público de imágenes de correo y reemplaza SOLO el src de esa
 * etiqueta en el HTML (ranuras-de-imagen.ts), sin pasar por el editor. El
 * guardado es el botón de siempre de la pantalla; la vista previa del correo
 * se actualiza sola porque lee el mismo estado.
 */
import { useRef, useState } from 'react'
import { ImageIcon, Upload } from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { useToast } from '@/components/shared/Toast'
import { ranurasDeImagen, reemplazarImagenDeRanura, tamanoRecomendado } from '@/lib/communications/ranuras-de-imagen'

const ACEPTA = 'image/jpeg,image/png'

export function ImagenesDePlantilla({ html, onChange }: { html: string; onChange: (html: string) => void }) {
  const toast = useToast()
  const [subiendo, setSubiendo] = useState<string | null>(null)
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})
  const ranuras = ranurasDeImagen(html)
  if (ranuras.length === 0) return null

  async function cambiar(slot: string, file: File | undefined) {
    if (!file || subiendo) return
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      toast('Usá una imagen JPG o PNG.', 'error'); return
    }
    setSubiendo(slot)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/communications/upload-image', { method: 'POST', body: fd })
      const d = await res.json().catch(() => null)
      if (!res.ok || !d?.url) throw new Error(d?.error ?? 'No se pudo subir la imagen.')
      onChange(reemplazarImagenDeRanura(html, slot, d.url))
      toast('Imagen cambiada. Revisá la vista previa y guardá.', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo subir la imagen.', 'error')
    } finally {
      setSubiendo(null)
      const inp = inputs.current[slot]
      if (inp) inp.value = ''
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--outline-variant)] bg-surface-card p-4 space-y-3">
      <div className="flex items-start gap-2">
        <ImageIcon size={16} className="mt-0.5 shrink-0 text-teal-deep" aria-hidden />
        <div>
          <p className="text-[13px] font-semibold text-navy font-display">Imágenes de esta plantilla</p>
          <p className="text-[13px] text-navy-light/80 font-body">
            Cambiá la imagen sin tocar el código: se reemplaza solo esa imagen y el diseño queda igual.
          </p>
        </div>
      </div>
      <ul className="space-y-3">
        {ranuras.map(r => (
          <li key={r.slot} className="flex flex-col gap-3 rounded-xl bg-surface-low p-3 sm:flex-row sm:items-center">
            {r.src ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL externa del bucket de correo, sin optimizar a propósito
              <img src={r.src} alt={r.alt ?? r.slot} className="h-20 w-32 shrink-0 rounded-lg object-cover bg-white" />
            ) : (
              <div className="flex h-20 w-32 shrink-0 items-center justify-center rounded-lg bg-white text-[11px] text-navy-light/80 font-body">Sin imagen</div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-navy font-body">{r.alt?.trim() || `Imagen «${r.slot}»`}</p>
              <p className="text-[13px] text-navy-light/80 font-body">{tamanoRecomendado(r)}</p>
            </div>
            <input
              ref={el => { inputs.current[r.slot] = el }}
              type="file"
              accept={ACEPTA}
              className="sr-only"
              aria-label={`Elegir nueva imagen para ${r.alt?.trim() || r.slot}`}
              onChange={e => cambiar(r.slot, e.target.files?.[0])}
            />
            <Button variante="secundario" tamano="sm" onClick={() => inputs.current[r.slot]?.click()} disabled={!!subiendo}>
              <Upload size={13} aria-hidden /> {subiendo === r.slot ? 'Subiendo…' : 'Cambiar imagen'}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
