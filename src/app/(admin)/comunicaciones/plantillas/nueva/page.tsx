'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { EmailPreview } from '@/components/communications/EmailPreview'
import { AVAILABLE_VARIABLES } from '@/components/communications/VariableChips'
import { FormatToggle } from '@/components/communications/FormatToggle'
import { KNOWN_CATEGORIES, categoryLabel } from '@/lib/communications/categories'
import { cn } from '@/lib/utils'
import { ChevronLeft, Check, X } from 'lucide-react'
import type { MessageTemplate } from '@/types/communication'

const NEW_CATEGORY = '__new__'

function insertAtCursor(ref: React.RefObject<HTMLTextAreaElement | null>, value: string, setter: (v: string) => void) {
  const el = ref.current
  if (!el) { setter(value); return }
  const start = el.selectionStart ?? 0
  const end = el.selectionEnd ?? 0
  const newText = el.value.slice(0, start) + value + el.value.slice(end)
  setter(newText)
  setTimeout(() => {
    el.focus()
    el.setSelectionRange(start + value.length, start + value.length)
  }, 0)
}

export default function NuevaPlantillaPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('general')
  // Categorías conocidas + las que ya existan en la BD (para reusar las creadas).
  const [categories, setCategories] = useState<string[]>([...KNOWN_CATEGORIES])
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [subject, setSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  // Formato del cuerpo del correo: texto plano (se escapa + nl2br al enviar) o HTML crudo.
  const [emailFormat, setEmailFormat] = useState<'text' | 'html'>('text')
  const [saved, setSaved] = useState(false)

  const emailRef = useRef<HTMLTextAreaElement>(null)

  // Trae las categorías ya usadas para ofrecerlas en el selector.
  useEffect(() => {
    let alive = true
    fetch('/api/communications/templates')
      .then(r => (r.ok ? r.json() : []))
      .then((tpls: MessageTemplate[]) => {
        if (!alive || !Array.isArray(tpls)) return
        const fromDb = tpls.map(t => t.category).filter(Boolean)
        setCategories([...new Set([...KNOWN_CATEGORIES, ...fromDb])])
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  async function handleSave() {
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/communications/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim() || 'general',
          channel: 'email',
          subject: subject.trim() || null,
          body: emailBody,
          body_format: emailFormat,
          is_active: true,
        }),
      })
      if (!res.ok) throw new Error()
      setSaved(true)
      setTimeout(() => router.push('/comunicaciones/plantillas'), 900)
    } catch {
      setSaving(false)
    }
  }

  const labelCls = 'text-[11px] text-navy-light/60 mb-1 block font-body'
  const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <Link
          href="/comunicaciones/plantillas"
          className="inline-flex items-center gap-1.5 text-sm text-navy-light/60 hover:text-navy transition-colors mb-2 font-body"
        >
          <ChevronLeft size={15} />
          Plantillas
        </Link>
        <h1 className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">
          Nueva plantilla de correo
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
        {/* Left: Form */}
        <div className="rounded-2xl p-6 space-y-5 bg-surface-card shadow-[var(--shadow-md)]">
          {/* Name */}
          <div>
            <label className={labelCls}>Nombre de la plantilla</label>
            <input
              className={inputCls}
              placeholder="ej. Bienvenida nueva persona"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          {/* Category */}
          <div>
            <label className={labelCls}>Categoría</label>
            {creatingCategory ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  className={inputCls}
                  placeholder="Nombre de la categoría nueva"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  aria-label="Nombre de la categoría nueva"
                />
                <button
                  type="button"
                  onClick={() => { setCreatingCategory(false); setCategory('general') }}
                  className="inline-flex items-center gap-1 rounded-xl border px-3 py-2.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body shrink-0"
                  aria-label="Elegir una categoría existente"
                >
                  <X size={13} /> Cancelar
                </button>
              </div>
            ) : (
              <select
                className={inputCls}
                value={category}
                onChange={e => {
                  if (e.target.value === NEW_CATEGORY) { setCreatingCategory(true); setCategory('') }
                  else setCategory(e.target.value)
                }}
              >
                {categories.map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}
                <option value={NEW_CATEGORY}>➕ Crear categoría nueva…</option>
              </select>
            )}
          </div>

          {/* Email subject */}
          <div>
            <label className={labelCls}>Asunto del correo</label>
            <input className={inputCls} placeholder="Asunto con variables: Hola {nombre}..." value={subject} onChange={e => setSubject(e.target.value)} />
          </div>

          {/* Email body */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={cn(labelCls, 'mb-0')}>Cuerpo del correo</label>
              <FormatToggle value={emailFormat} onChange={setEmailFormat} />
            </div>
            <textarea
              ref={emailRef}
              rows={emailFormat === 'html' ? 12 : 7}
              className={cn(inputCls, 'resize-none', emailFormat === 'html' && 'font-mono text-[12px]')}
              placeholder={emailFormat === 'html'
                ? '<p>Hola {nombre},</p>\n<p>...</p>'
                : 'Hola {nombre},&#10;&#10;...'}
              value={emailBody}
              onChange={e => setEmailBody(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-navy-light/60 font-body">
              {emailFormat === 'html'
                ? 'Escribí HTML; se envía tal cual. Usá {nombre} para el nombre de la persona.'
                : 'Texto plano; los saltos de línea se respetan. Usá {nombre} para el nombre de la persona.'}
            </p>
          </div>

          {/* Variables panel */}
          <div className="rounded-xl p-4 space-y-3 bg-surface-low">
            <p className="text-[10px] uppercase tracking-widests text-navy-light/60 font-semibold font-display">
              Variables disponibles
            </p>
            <div className="space-y-2">
              {AVAILABLE_VARIABLES.map(v => (
                <div key={v.key} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => insertAtCursor(emailRef, v.key, setEmailBody)}
                      className="rounded-full border px-2.5 py-0.5 text-[11px] font-mono text-navy-light hover:bg-navy hover:text-white hover:border-navy transition-all border-[var(--outline-variant)]"
                    >
                      {v.key}
                    </button>
                  </div>
                  <span className="text-[11px] text-navy-light/60 font-body">{v.description}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--outline-variant)]">
            <Link
              href="/comunicaciones/plantillas"
              className="rounded-full border px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
            >
              Cancelar
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !name.trim() || !emailBody || (creatingCategory && !category.trim())}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed font-body',
                saved ? 'bg-teal-deep' : 'bg-coral hover:bg-coral-deep'
              )}
            >
              {saved ? <><Check size={14} /> Guardada</> : 'Guardar plantilla'}
            </button>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="space-y-3 lg:sticky lg:top-4">
          <p className="text-[10px] uppercase tracking-widests text-navy-light/60 font-display">
            Vista previa
          </p>
          <EmailPreview subject={subject} body={emailBody || 'El mensaje aparecerá aquí...'} format={emailFormat} />
        </div>
      </div>
    </div>
  )
}
