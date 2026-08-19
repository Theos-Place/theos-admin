'use client'

// Cuerpo de un artículo de ayuda. El HTML lo genera renderMarkdown en el
// servidor a partir de un .md del repo (contenido propio, no de usuarios).
// Este componente existe por una sola cosa interactiva: tocar una imagen o
// infografía la abre a pantalla completa, que en el celular es la diferencia
// entre poder leerla y no.

import { useEffect, useState } from 'react'
import { X, Maximize2 } from 'lucide-react'

export function HelpArticle({ html }: { html: string }) {
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null)

  useEffect(() => {
    if (!zoom) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoom(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [zoom])

  function onClick(e: React.MouseEvent<HTMLDivElement>) {
    const el = (e.target as HTMLElement).closest('img')
    if (!el) return
    setZoom({ src: el.getAttribute('src') ?? '', alt: el.getAttribute('alt') ?? '' })
  }

  return (
    <>
      <div
        onClick={onClick}
        className="help-prose"
        // El HTML viene de un .md versionado en el repo y renderMarkdown escapa
        // el texto: no hay entrada de usuario en este camino.
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {zoom && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={zoom.alt || 'Imagen ampliada'}
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-50 overflow-auto bg-navy/95 p-4"
        >
          <button
            type="button"
            onClick={() => setZoom(null)}
            aria-label="Cerrar imagen"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
          >
            <X size={20} />
          </button>
          {/* En el celular la infografía se muestra a su ancho real y se
              arrastra para leerla; encogerla a 390px la vuelve ilegible. En
              pantallas grandes entra completa. */}
          <div className="flex min-h-full items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={zoom.src}
              alt={zoom.alt}
              onClick={e => e.stopPropagation()}
              className="h-auto min-w-[860px] max-w-none sm:min-w-0 sm:max-h-[92vh] sm:max-w-full sm:object-contain"
            />
          </div>
        </div>
      )}
    </>
  )
}

/** Pista visual de que las imágenes se pueden ampliar (se muestra si el artículo
 *  trae al menos una). */
export function ZoomHint() {
  return (
    <p className="flex items-center gap-1.5 text-[13px] text-navy-light/80 font-body">
      <Maximize2 size={12} />
      Tocá una imagen para verla a pantalla completa
    </p>
  )
}
