'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { EmailPreview } from '@/components/communications/EmailPreview'
import { EmailEditor } from '@/components/communications/EmailEditorLazy'
import { isAdvancedHtml, advancedHtmlNotice } from '@/components/communications/email-html'
import { saveTemplate } from '@/lib/communications/save-template'
import { useToast } from '@/components/shared/Toast'
import { renderEmail } from '@/lib/email/baseLayout'
import { AVAILABLE_VARIABLES } from '@/components/communications/VariableChips'
import { KNOWN_CATEGORIES, categoryLabel } from '@/lib/communications/categories'
import { cn } from '@/lib/utils'
import { ChevronLeft, Check, X } from 'lucide-react'
import type { MessageTemplate } from '@/types/communication'

const NEW_CATEGORY = '__new__'

export default function NuevaPlantillaPage() {
  const router = useRouter()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('general')
  // Categorías conocidas + las que ya existan en la BD (para reusar las creadas).
  const [categories, setCategories] = useState<string[]>([...KNOWN_CATEGORIES])
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [subject, setSubject] = useState('')
  // El editor produce HTML (visual o crudo) → la plantilla se guarda como html.
  const [emailBody, setEmailBody] = useState('')
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  // Pegajoso a propósito: si en algún momento el cuerpo tuvo diseño avanzado
  // (lo pegaron en modo código), el editor NO vuelve solo a visual — volver
  // sería justamente lo que aplana la plantilla.
  const [everAdvanced, setEverAdvanced] = useState(false)
  function onBodyChange(html: string) {
    setEmailBody(html)
    if (!everAdvanced && isAdvancedHtml(html)) setEverAdvanced(true)
  }

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

  function copyVar(key: string) {
    navigator.clipboard?.writeText(key).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1200)
    }).catch(() => {})
  }

  async function handleSave() {
    if (saving) return
    setSaving(true)
    const res = await saveTemplate({
      name: name.trim(),
      category: category.trim() || 'general',
      channel: 'email',
      subject: subject.trim() || null,
      body: emailBody,
      body_format: 'html',
      is_active: true,
    })
    if (!res.ok) {
      // Antes el catch era mudo y el botón volvía a "Guardar" sin explicar nada.
      toast(res.error, 'error')
      setSaving(false)
      return
    }
    setSaved(true)
    toast('Plantilla creada.', 'success')
    setTimeout(() => router.push('/comunicaciones/plantillas'), 900)
  }

  const labelCls = 'text-[13px] text-navy-light/80 mb-1 block font-body'
  const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'
  // El preview muestra el correo completo (layout base + pie de baja), igual que el envío.
  const rawPreview = emailBody.replace(/<[^>]*>/g, '').trim() ? emailBody : '<p style="color:#9aa">El mensaje aparecerá aquí…</p>'
  // Logo same-origin en el preview (CSP del iframe); el envío usa la URL absoluta.
  const previewBody = renderEmail(rawPreview, { unsubscribeUrl: '#', logoUrl: '/logo-theos-white.png' })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <Link
          href="/comunicaciones/plantillas"
          className="inline-flex items-center gap-1.5 text-sm text-navy-light/80 hover:text-navy transition-colors mb-2 font-body"
        >
          <ChevronLeft size={15} />
          Plantillas
        </Link>
        <h1 className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">
          Nueva plantilla de correo
        </h1>
      </div>

      {/* Editor (izquierda) + preview al lado (derecha). Apila en pantallas chicas. */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_620px] gap-6 items-start">
      {/* Datos + editor */}
      <div className="rounded-2xl p-6 space-y-5 bg-surface-card shadow-[var(--shadow-md)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="nombre-de-la-plantilla" className={labelCls}>Nombre de la plantilla</label>
            <input id="nombre-de-la-plantilla" className={inputCls} placeholder="ej. Bienvenida nueva persona" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <span className={labelCls}>Categoría</span>
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
                  className="inline-flex items-center gap-1 rounded-xl border px-3 py-2.5 text-[13px] text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body shrink-0"
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
        </div>

        <div>
          <label htmlFor="asunto-del-correo" className={labelCls}>Asunto del correo</label>
          <input id="asunto-del-correo" className={inputCls} placeholder="Asunto con variables: Hola {nombre}..." value={subject} onChange={e => setSubject(e.target.value)} />
        </div>

        <div>
          <span className={labelCls}>Cuerpo del correo</span>
          <EmailEditor
            value={emailBody}
            onChange={onBodyChange}
            htmlOnly={everAdvanced}
            htmlOnlyNotice={advancedHtmlNotice(emailBody)}
          />
          <p className="mt-1.5 text-[13px] text-navy-light/80 font-body">
            Editá en modo Visual o pegá HTML. Mantené el HTML simple por compatibilidad con clientes de correo. El pie de baja se agrega solo al enviar como marketing.
          </p>
        </div>

        {/* Variables (copiar) */}
        <div className="rounded-xl p-3 bg-surface-low">
          <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-semibold font-display mb-2">Variables (clic para copiar)</p>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_VARIABLES.map(v => (
              <button
                key={v.key}
                type="button"
                onClick={() => copyVar(v.key)}
                title={v.description}
                className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[13px] font-mono text-navy-light hover:bg-navy hover:text-white hover:border-navy transition-all border-[var(--outline-variant)]"
              >
                {copied === v.key ? '¡copiado!' : v.key}
              </button>
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
            disabled={saving || !name.trim() || !emailBody.trim() || (creatingCategory && !category.trim())}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed font-body',
              saved ? 'bg-teal-deep' : 'bg-coral hover:bg-coral-deep'
            )}
          >
            {saved ? <><Check size={14} /> Guardada</> : 'Guardar plantilla'}
          </button>
        </div>
      </div>

      {/* Preview al lado (sticky en desktop); el correo se centra a 600px */}
      <div className="space-y-2 xl:sticky xl:top-4">
        <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display">Vista previa</p>
        <EmailPreview subject={subject} body={previewBody} format="html" fullDocument />
      </div>
      </div>
    </div>
  )
}
