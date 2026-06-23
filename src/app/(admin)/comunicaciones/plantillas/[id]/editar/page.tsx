'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { EmailPreview } from '@/components/communications/EmailPreview'
import { EmailEditor } from '@/components/communications/EmailEditor'
import { AVAILABLE_VARIABLES } from '@/components/communications/VariableChips'
import { KNOWN_CATEGORIES, categoryLabel } from '@/lib/communications/categories'
import { useCommunications } from '@/hooks/useCommunications'
import { renderEmail } from '@/lib/email/baseLayout'
import { renderTemplate, PREVIEW_SAMPLE } from '@/lib/email/render-vars'
import { cn } from '@/lib/utils'
import { ChevronLeft, Check, X } from 'lucide-react'

const NEW_CATEGORY = '__new__'

export default function EditarPlantillaPage() {
  const router = useRouter()
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : ''
  const { templates, loading } = useCommunications()

  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('general')
  const [categories, setCategories] = useState<string[]>([...KNOWN_CATEGORIES])
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [subject, setSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [isSystem, setIsSystem] = useState(false)
  const [systemVars, setSystemVars] = useState<string[]>([])

  // Carga inicial: precarga los datos de la plantilla una sola vez.
  useEffect(() => {
    if (loaded || loading) return
    const tpl = templates.find(t => t.id === id)
    if (!tpl) { if (!loading) setNotFound(true); return }
    setName(tpl.name)
    setCategory(tpl.category || 'general')
    setSubject(tpl.subject || '')
    setEmailBody(tpl.body || '')
    setIsSystem(tpl.is_system)
    setSystemVars(tpl.available_variables ?? [])
    setCategories([...new Set([...KNOWN_CATEGORIES, ...templates.map(t => t.category).filter(Boolean)])])
    setLoaded(true)
  }, [loading, templates, id, loaded])

  function copyVar(key: string) {
    navigator.clipboard?.writeText(key).then(() => { setCopied(key); setTimeout(() => setCopied(null), 1200) }).catch(() => {})
  }

  async function handleSave() {
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/communications/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim() || 'general',
          subject: subject.trim() || null,
          body: emailBody,
          body_format: 'html',
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
  const rawPreview = emailBody.replace(/<[^>]*>/g, '').trim() ? emailBody : '<p style="color:#9aa">El mensaje aparecerá aquí…</p>'
  // El preview SIEMPRE muestra el correo completo (layout base), igual que el envío:
  //  · sistema → variables {{...}} con valores de ejemplo;
  //  · marketing → con el pie de baja (como en el envío real).
  const previewBody = isSystem
    ? renderEmail(renderTemplate(rawPreview, PREVIEW_SAMPLE))
    : renderEmail(rawPreview, { unsubscribeUrl: '#' })

  if (notFound) {
    return (
      <div className="space-y-4">
        <Link href="/comunicaciones/plantillas" className="inline-flex items-center gap-1.5 text-sm text-navy-light/60 hover:text-navy transition-colors font-body"><ChevronLeft size={15} /> Plantillas</Link>
        <p className="text-sm text-coral font-body">No se encontró la plantilla.</p>
      </div>
    )
  }
  if (!loaded) {
    return <div className="p-8 text-center text-navy-light/60 font-body">Cargando…</div>
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href="/comunicaciones/plantillas" className="inline-flex items-center gap-1.5 text-sm text-navy-light/60 hover:text-navy transition-colors mb-2 font-body">
          <ChevronLeft size={15} /> Plantillas
        </Link>
        <h1 className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">Editar plantilla de correo</h1>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_620px] gap-6 items-start">
        <div className="rounded-2xl p-6 space-y-5 bg-surface-card shadow-[var(--shadow-md)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nombre de la plantilla</label>
              <input className={inputCls} value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Categoría</label>
              {creatingCategory ? (
                <div className="flex items-center gap-2">
                  <input autoFocus className={inputCls} placeholder="Nombre de la categoría nueva" value={category} onChange={e => setCategory(e.target.value)} aria-label="Nombre de la categoría nueva" />
                  <button type="button" onClick={() => { setCreatingCategory(false); setCategory('general') }} className="inline-flex items-center gap-1 rounded-xl border px-3 py-2.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body shrink-0" aria-label="Elegir una categoría existente"><X size={13} /> Cancelar</button>
                </div>
              ) : (
                <select className={inputCls} value={category} onChange={e => { if (e.target.value === NEW_CATEGORY) { setCreatingCategory(true); setCategory('') } else setCategory(e.target.value) }}>
                  {categories.map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}
                  <option value={NEW_CATEGORY}>➕ Crear categoría nueva…</option>
                </select>
              )}
            </div>
          </div>

          <div>
            <label className={labelCls}>Asunto del correo</label>
            <input className={inputCls} placeholder="Asunto con variables: Hola {nombre}..." value={subject} onChange={e => setSubject(e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>Cuerpo del correo</label>
            <EmailEditor value={emailBody} onChange={setEmailBody} htmlOnly={isSystem} />
            <p className="mt-1.5 text-[11px] text-navy-light/60 font-body">El pie de baja se agrega solo al enviar como marketing.</p>
          </div>

          <div className="rounded-xl p-3 bg-surface-low">
            <p className="text-[10px] uppercase tracking-widest text-navy-light/60 font-semibold font-display mb-2">
              {isSystem ? 'Variables disponibles (clic para copiar)' : 'Variables (clic para copiar)'}
            </p>
            <div className="flex flex-wrap gap-2">
              {(isSystem ? systemVars.map(v => `{{${v}}}`) : AVAILABLE_VARIABLES.map(v => v.key)).map(token => (
                <button key={token} type="button" onClick={() => copyVar(token)} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-mono text-navy-light hover:bg-navy hover:text-white hover:border-navy transition-all border-[var(--outline-variant)]">
                  {copied === token ? '¡copiado!' : token}
                </button>
              ))}
            </div>
            {isSystem && (
              <p className="mt-2 text-[11px] text-navy-light/60 font-body">
                Plantilla del sistema: editá el contenido, pero mantené las variables {'{{...}}'} para que el envío automático las reemplace.
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-[var(--outline-variant)]">
            <Link href="/comunicaciones/plantillas" className="rounded-full border px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body">Cancelar</Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !name.trim() || !emailBody.trim() || (creatingCategory && !category.trim())}
              className={cn('inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed font-body', saved ? 'bg-teal-deep' : 'bg-coral hover:bg-coral-deep')}
            >
              {saved ? <><Check size={14} /> Guardada</> : 'Guardar cambios'}
            </button>
          </div>
        </div>

        <div className="space-y-2 xl:sticky xl:top-4">
          <p className="text-[10px] uppercase tracking-widest text-navy-light/60 font-display">Vista previa</p>
          <EmailPreview subject={subject} body={previewBody} format="html" fullDocument />
        </div>
      </div>
    </div>
  )
}
