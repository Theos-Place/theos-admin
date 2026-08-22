'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import {
  Bold, Italic, Underline as UnderlineIcon, Heading1, Heading2, Heading3,
  List, ListOrdered, Link2, Link2Off, ImageIcon, AlignLeft, AlignCenter, AlignRight, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FORCE_VISUAL_WARNING } from './email-html'

// isAdvancedHtml vive en ./email-html (módulo sin TipTap) para poder importarlo
// sin arrastrar el editor al bundle. Importá el editor vía ./EmailEditorLazy.

/**
 * Editor de email reutilizable (plantillas y campañas). Dos modos por pestañas:
 *  · Visual (WYSIWYG con TipTap) → HTML semántico limpio (sin clases), apto para
 *    correo: <p>, <strong>, <em>, <u>, <h1-3>, <ul>/<ol>, <a>, <img>, text-align inline.
 *  · HTML → textarea con el código crudo (pegar/editar HTML directo).
 * La fuente de verdad es el string HTML (value/onChange). El pie de baja NO va
 * acá: lo inyecta el envío de marketing.
 */
export function EmailEditor({ value, onChange, variables = [], htmlOnly = false, htmlOnlyNotice, ariaLabel = 'Cuerpo del correo' }: {
  value: string
  onChange: (html: string) => void
  /** Variables insertables (ej. [{ key: '{nombre}' }]) — botones que las meten en el cuerpo. */
  variables?: Array<{ key: string; description?: string }>
  /** true = arranca (y se queda) en modo HTML: para contenido que el editor
   *  visual destruiría — plantillas del sistema o HTML avanzado. La pestaña
   *  Visual sigue visible, pero pide confirmación explícita. */
  htmlOnly?: boolean
  /** Aviso que explica POR QUÉ quedó en modo código. */
  htmlOnlyNotice?: string
  /** AUD-1 · Nombre accesible del área editable. Default 'Cuerpo del correo'. */
  ariaLabel?: string
}) {
  const [mode, setMode] = useState<'visual' | 'html'>(htmlOnly ? 'html' : 'visual')
  // Bug 2026-08-06: alguien podía forzar Visual y perder el diseño sin enterarse.
  // Ahora hay que confirmarlo; mientras no se confirme, el visual no se monta.
  const [visualForzado, setVisualForzado] = useState(false)
  const [confirmarVisual, setConfirmarVisual] = useState(false)
  const soloHtml = htmlOnly && !visualForzado
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const htmlRef = useRef<HTMLTextAreaElement>(null)

  const editor = useEditor({
    immediatelyRender: false, // Next SSR
    extensions: [
      // StarterKit v3 ya incluye Underline y Link (no agregarlos aparte).
      StarterKit.configure({
        link: { openOnClick: false, HTMLAttributes: { rel: 'noopener', style: 'color:#3B7579' } },
      }),
      Image.configure({ HTMLAttributes: { style: 'max-width:100%;height:auto' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    // En modo código NO le pasamos el HTML complejo a TipTap (ni para parsearlo):
    // el contenido vive solo en el textarea, intacto.
    content: htmlOnly ? '' : (value || ''),
    editorProps: {
      // Se edita con el MISMO look del correo: fuente del sistema, 14px, color
      // #333, ancho 600px centrado sobre blanco (igual que el iframe del preview).
      attributes: {
        // AUD-1 · El área editable es un contenteditable, no un <input>: un
        // <label> de al lado no la alcanza. Su nombre accesible va acá.
        'aria-label': ariaLabel,
        role: 'textbox',
        'aria-multiline': 'true',
        class: 'prose-email focus:outline-none min-h-[260px] py-5 px-5 mx-auto w-full max-w-[600px]',
        style: "font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.5; color: #333;",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  // Sincroniza el editor con `value`: al volver de HTML a Visual, y también
  // cuando el value LLEGA DESPUÉS del montaje.
  //
  // Bug 2026-08-06 (raíz de COM-3): este efecto dependía solo de [mode]. Al
  // aplicar una plantilla —el contenido se setea después de que el editor ya
  // montó— el editor nunca se enteraba y el cuerpo se veía vacío. La guarda
  // `getHTML() !== value` evita el reseteo en cada tecla: al escribir, onUpdate
  // deja value === getHTML() y este efecto no hace nada.
  useEffect(() => {
    if (mode === 'visual' && editor && editor.getHTML() !== value) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
  }, [mode, value, editor])

  const addLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('URL del enlace (https://…)', prev ?? 'https://')
    if (url === null) return
    if (url.trim() === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }, [editor])

  // REGLA DE IMÁGENES: toda imagen que se suba debe alojarse en el storage del
  // sistema (Supabase Storage del proyecto, bucket público email-images, servido
  // bajo el dominio admin.theosplace.org), NUNCA enlazada desde sitios externos
  // de terceros (pueden caerse, bloquear hotlinking o cambiar el contenido). El
  // logo embebido en las plantillas (base64/SVG) se deja como está.
  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite re-subir el mismo archivo
    if (!file || !editor) return
    setUploadError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/communications/upload-image', { method: 'POST', body: fd })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.url) throw new Error(data?.error || 'No se pudo subir la imagen')
      editor.chain().focus().setImage({ src: data.url }).run()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'No se pudo subir la imagen')
    } finally {
      setUploading(false)
    }
  }

  // Inserta una variable ({nombre}) en el cuerpo: en visual usa el editor; en
  // HTML, en la posición del cursor del textarea.
  function insertVariable(token: string) {
    if (mode === 'visual') {
      editor?.chain().focus().insertContent(token).run()
      return
    }
    const el = htmlRef.current
    if (!el) { onChange(value + token); return }
    const s = el.selectionStart ?? value.length
    const e = el.selectionEnd ?? s
    const next = value.slice(0, s) + token + value.slice(e)
    onChange(next)
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + token.length, s + token.length) })
  }

  const btn = (active: boolean) => cn(
    'inline-flex items-center justify-center h-8 w-8 rounded-lg transition-colors',
    active ? 'bg-navy text-white' : 'text-navy-light/80 hover:bg-surface-low',
  )

  return (
    <div className="rounded-2xl border border-[var(--outline-variant)] overflow-hidden bg-surface-card">
      {/* Tabs Visual / HTML (en htmlOnly solo HTML) */}
      <div className="flex border-b border-[var(--outline-variant)] bg-surface-low/50">
        {(['visual', 'html'] as const).map(m => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              // Forzar Visual sobre contenido avanzado se confirma; nunca pasa
              // en silencio.
              if (m === 'visual' && soloHtml) { setConfirmarVisual(true); return }
              setMode(m)
            }}
            className={cn('px-4 py-2 text-sm font-body border-b-2 -mb-px transition-colors',
              mode === m ? 'border-coral text-navy font-semibold' : 'border-transparent text-navy-light/80 hover:text-navy')}
          >
            {m === 'visual' ? 'Visual' : 'HTML'}
          </button>
        ))}
      </div>

      {soloHtml && (
        <p className="px-3 py-2 text-[13px] text-navy-light/80 font-body bg-amber-50 border-b border-[var(--outline-variant)]">
          {htmlOnlyNotice ?? 'Esta plantilla tiene diseño avanzado; se edita en modo código para no perder el formato.'}
        </p>
      )}

      {confirmarVisual && (
        <div role="alertdialog" aria-label="Confirmar edición visual" className="px-4 py-3 border-b border-[var(--outline-variant)] bg-coral-soft/20 space-y-2">
          <p className="text-[13px] text-navy font-body">{FORCE_VISUAL_WARNING}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setConfirmarVisual(false); setVisualForzado(true); setMode('visual') }}
              className="rounded-full bg-coral px-3 py-1.5 text-[13px] text-white hover:bg-coral-deep transition-colors font-body"
            >
              Editar en visual y perder el diseño
            </button>
            <button
              type="button"
              onClick={() => setConfirmarVisual(false)}
              className="rounded-full border border-[var(--outline-variant)] px-3 py-1.5 text-[13px] text-navy-light hover:bg-surface-low transition-colors font-body"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {!soloHtml && mode === 'visual' ? (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-[var(--outline-variant)]">
            <button type="button" aria-label="Negrita" title="Negrita" className={btn(!!editor?.isActive('bold'))} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={15} /></button>
            <button type="button" aria-label="Cursiva" title="Cursiva" className={btn(!!editor?.isActive('italic'))} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={15} /></button>
            <button type="button" aria-label="Subrayado" title="Subrayado" className={btn(!!editor?.isActive('underline'))} onClick={() => editor?.chain().focus().toggleUnderline().run()}><UnderlineIcon size={15} /></button>
            <span className="mx-1 h-5 w-px bg-[var(--outline-variant)]" />
            <button type="button" aria-label="Título 1" title="Título 1" className={btn(!!editor?.isActive('heading', { level: 1 }))} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={15} /></button>
            <button type="button" aria-label="Título 2" title="Título 2" className={btn(!!editor?.isActive('heading', { level: 2 }))} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={15} /></button>
            <button type="button" aria-label="Título 3" title="Título 3" className={btn(!!editor?.isActive('heading', { level: 3 }))} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={15} /></button>
            <span className="mx-1 h-5 w-px bg-[var(--outline-variant)]" />
            <button type="button" aria-label="Lista con viñetas" title="Viñetas" className={btn(!!editor?.isActive('bulletList'))} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List size={15} /></button>
            <button type="button" aria-label="Lista numerada" title="Numerada" className={btn(!!editor?.isActive('orderedList'))} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} /></button>
            <span className="mx-1 h-5 w-px bg-[var(--outline-variant)]" />
            <button type="button" aria-label="Alinear a la izquierda" title="Izquierda" className={btn(!!editor?.isActive({ textAlign: 'left' }))} onClick={() => editor?.chain().focus().setTextAlign('left').run()}><AlignLeft size={15} /></button>
            <button type="button" aria-label="Centrar" title="Centro" className={btn(!!editor?.isActive({ textAlign: 'center' }))} onClick={() => editor?.chain().focus().setTextAlign('center').run()}><AlignCenter size={15} /></button>
            <button type="button" aria-label="Alinear a la derecha" title="Derecha" className={btn(!!editor?.isActive({ textAlign: 'right' }))} onClick={() => editor?.chain().focus().setTextAlign('right').run()}><AlignRight size={15} /></button>
            <span className="mx-1 h-5 w-px bg-[var(--outline-variant)]" />
            <button type="button" aria-label="Enlace" title="Enlace" className={btn(!!editor?.isActive('link'))} onClick={addLink}><Link2 size={15} /></button>
            <button type="button" aria-label="Quitar enlace" title="Quitar enlace" className={btn(false)} onClick={() => editor?.chain().focus().unsetLink().run()} disabled={!editor?.isActive('link')}><Link2Off size={15} /></button>
            <button type="button" aria-label="Insertar imagen" title="Imagen" className={btn(false)} onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <ImageIcon size={15} />}
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={onPickImage} />
          </div>
          <div className="max-h-[460px] overflow-auto bg-white [&_.ProseMirror]:break-words [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_a]:text-[#3B7579] [&_.ProseMirror_a]:underline [&_.ProseMirror_h1]:text-2xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:my-2 [&_.ProseMirror_h2]:text-xl [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:my-2 [&_.ProseMirror_h3]:text-lg [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:my-1.5 [&_.ProseMirror_p]:my-2 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ul]:my-2 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_ol]:my-2">
            <EditorContent editor={editor} />
          </div>
          {uploadError && <p className="px-4 py-2 text-[13px] text-coral font-body border-t border-[var(--outline-variant)]">{uploadError}</p>}
        </>
      ) : (
        <textarea
          ref={htmlRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={16}
          spellCheck={false}
          placeholder="<p>Hola {nombre},</p>"
          className="w-full max-w-full resize-y bg-surface-card px-4 py-3 text-[13px] font-mono text-navy outline-none block overflow-auto"
        />
      )}

      {/* Variables insertables: clic → se mete en el cuerpo (en el cursor). */}
      {variables.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-t border-[var(--outline-variant)] bg-surface-low/40">
          <span className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display mr-1">Insertar variable</span>
          {variables.map(v => (
            <button
              key={v.key}
              type="button"
              title={v.description}
              onClick={() => insertVariable(v.key)}
              className="rounded-full border px-2.5 py-0.5 text-[13px] font-mono text-navy-light hover:bg-navy hover:text-white hover:border-navy transition-all border-[var(--outline-variant)]"
            >
              {v.key}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
