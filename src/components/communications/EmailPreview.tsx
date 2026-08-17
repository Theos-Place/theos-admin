'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'

interface Props {
  subject: string
  body: string
  fromName?: string
  previewName?: string
  /** 'html' renderiza el código tal cual; 'text' (default) respeta saltos de línea. */
  format?: 'text' | 'html'
  /** true = `body` ya es un documento HTML completo (layout incluido): el iframe
   *  lo usa tal cual, sin envolverlo en el wrapper de 600px. */
  fullDocument?: boolean
  /** Alto máximo del marco. El default (1200) sirve para el editor, donde el
   *  preview vive en una columna; en un modal que ya scrollea conviene subirlo,
   *  porque pasado ese alto el correo QUEDA CORTADO (el iframe no scrollea). */
  maxHeight?: number
}

/** Documento HTML aislado para el iframe del preview. El cuerpo del email se
 *  centra a 600px (ancho realista de un correo) y se resetea el margen. */
function srcDocFor(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  html,body{margin:0;padding:0}
  body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#333;background:#fff;font-size:14px;line-height:1.5;word-wrap:break-word}
  .wrap{max-width:600px;margin:0 auto;padding:20px}
  img{max-width:100%;height:auto}
  a{color:#519DA2}
</style></head>
<body><div class="wrap">${html}</div></body></html>`
}

export function EmailPreview({ subject, body, fromName = 'Theos Place', previewName = 'María', format = 'text', fullDocument = false, maxHeight = 1200 }: Props) {
  const hydratedBody = body.replace(/\{nombre\}/g, previewName)
  const hydratedSubject = subject.replace(/\{nombre\}/g, previewName)
  const [frameH, setFrameH] = useState(420)

  const observerRef = useRef<ResizeObserver | null>(null)

  // El alto se sigue midiendo DESPUÉS del load: al disparar 'load' el logo
  // todavía no ocupa su alto final, y medir una sola vez dejaba el correo
  // cortado unos píxeles antes de la firma.
  function onFrameLoad(e: React.SyntheticEvent<HTMLIFrameElement>) {
    try {
      const doc = e.currentTarget.contentDocument
      if (!doc?.body) return
      const measure = () => setFrameH(Math.min(maxHeight, Math.max(240, doc.body.scrollHeight + 8)))
      measure()
      observerRef.current?.disconnect()
      const ro = new ResizeObserver(measure)
      ro.observe(doc.body)
      observerRef.current = ro
    } catch { /* sandbox: ignorar */ }
  }

  useEffect(() => () => observerRef.current?.disconnect(), [])

  return (
    <div className="rounded-2xl overflow-hidden border border-[var(--outline-variant)] bg-white">
      {/* Email client header bar */}
      <div className="px-4 py-2 border-b flex items-center gap-2 border-[#e0e0e0] bg-[#f8f8f8]">
        <div className="h-3 w-3 rounded-full bg-red-400" />
        <div className="h-3 w-3 rounded-full bg-yellow-400" />
        <div className="h-3 w-3 rounded-full bg-green-400" />
        <span className="ml-2 text-[12px] text-gray-400 font-body">Vista previa de correo</span>
      </div>

      {/* Email meta */}
      <div className="px-5 py-4 border-b space-y-1.5 border-[#e0e0e0]">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] uppercase tracking-widest text-gray-400 w-14 shrink-0 font-display">De</span>
          <span className="text-[12px] text-gray-700 font-body">{fromName} &lt;no-reply@theosplace.org&gt;</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] uppercase tracking-widest text-gray-400 w-14 shrink-0 font-display">Para</span>
          <span className="text-[12px] text-gray-700 font-body">{previewName} Rodríguez &lt;maria@ejemplo.com&gt;</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] uppercase tracking-widest text-gray-400 w-14 shrink-0 font-display">Asunto</span>
          <span className="text-[12px] font-semibold text-gray-800 font-body">{hydratedSubject || '(sin asunto)'}</span>
        </div>
      </div>

      {format === 'html' ? (
        // HTML SIEMPRE en iframe aislado: el CSS del correo no puede filtrarse y
        // romper la app, y se ve a ancho real. sandbox sin scripts (seguro).
        <iframe
          title="Vista previa del correo"
          srcDoc={fullDocument ? hydratedBody : srcDocFor(hydratedBody)}
          onLoad={onFrameLoad}
          sandbox="allow-same-origin"
          className="w-full border-0 bg-white block"
          style={{ height: frameH }}
        />
      ) : (
        <div className="px-5 py-5">
          <div className="flex justify-center mb-5">
            <Image src="/logo-theos-white.png" alt="Theos Place" width={80} height={22} className="object-contain opacity-40" />
          </div>
          <p className="text-[13px] leading-relaxed text-gray-700 whitespace-pre-line font-body break-words">
            {hydratedBody}
          </p>
          <div className="mt-6 pt-4 border-t text-center border-[#f0f0f0]">
            <p className="text-[12px] text-gray-400 font-body">Theos Place · theosplace.org</p>
          </div>
        </div>
      )}
    </div>
  )
}
