'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { WhatsAppPreview } from '@/components/communications/WhatsAppPreview'
import { EmailPreview } from '@/components/communications/EmailPreview'
import { VariableChips, AVAILABLE_VARIABLES } from '@/components/communications/VariableChips'
import { cn } from '@/lib/utils'
import { ChevronLeft, Check } from 'lucide-react'
import type { CommunicationChannel, MessageTemplate } from '@/types/communication'

type Category = MessageTemplate['category']

const CATEGORY_OPTIONS: { key: Category; label: string }[] = [
  { key: 'bienvenida',   label: 'Bienvenida' },
  { key: 'recordatorio', label: 'Recordatorio' },
  { key: 'inscripcion',  label: 'Inscripción' },
  { key: 'cancelacion',  label: 'Cancelación' },
  { key: 'general',      label: 'General' },
]

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
  const [category, setCategory] = useState<Category>('general')
  const [channel, setChannel] = useState<CommunicationChannel>('whatsapp')
  const [subject, setSubject] = useState('')
  const [waBody, setWaBody] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [saved, setSaved] = useState(false)
  const [previewChannel, setPreviewChannel] = useState<'whatsapp' | 'email'>('whatsapp')

  const waRef = useRef<HTMLTextAreaElement>(null)
  const emailRef = useRef<HTMLTextAreaElement>(null)

  async function handleSave() {
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/communications/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category,
          channel,
          subject: (channel === 'email' || channel === 'both') ? (subject.trim() || null) : null,
          body: channel === 'email' ? emailBody : waBody,
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
          Nueva plantilla
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

          {/* Category + Channel */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Categoría</label>
              <select
                className={inputCls}
                value={category}
                onChange={e => setCategory(e.target.value as Category)}
              >
                {CATEGORY_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Canal</label>
              <select
                className={inputCls}
                value={channel}
                onChange={e => {
                  setChannel(e.target.value as CommunicationChannel)
                  setPreviewChannel(e.target.value === 'email' ? 'email' : 'whatsapp')
                }}
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="both">Ambos</option>
              </select>
            </div>
          </div>

          {/* Email subject */}
          {(channel === 'email' || channel === 'both') && (
            <div>
              <label className={labelCls}>Asunto del correo</label>
              <input className={inputCls} placeholder="Asunto con variables: Hola {nombre}..." value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
          )}

          {/* WhatsApp body */}
          {(channel === 'whatsapp' || channel === 'both') && (
            <div>
              <label className={labelCls}>
                Cuerpo del mensaje WhatsApp <span className="text-navy-light/60">(soporta *negrita*, _itálica_, ~tachado~)</span>
              </label>
              <textarea
                ref={waRef}
                rows={7}
                className={cn(inputCls, 'resize-none')}
                placeholder="Hola {nombre} 👋&#10;&#10;..."
                value={waBody}
                onChange={e => setWaBody(e.target.value)}
                onFocus={() => setPreviewChannel('whatsapp')}
              />
            </div>
          )}

          {/* Email body */}
          {(channel === 'email' || channel === 'both') && (
            <div>
              <label className={labelCls}>Cuerpo del correo</label>
              <textarea
                ref={emailRef}
                rows={7}
                className={cn(inputCls, 'resize-none')}
                placeholder="Hola {nombre},&#10;&#10;..."
                value={emailBody}
                onChange={e => setEmailBody(e.target.value)}
                onFocus={() => setPreviewChannel('email')}
              />
            </div>
          )}

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
                      onClick={() => {
                        if (previewChannel === 'whatsapp' || channel === 'whatsapp') {
                          insertAtCursor(waRef, v.key, setWaBody)
                        } else {
                          insertAtCursor(emailRef, v.key, setEmailBody)
                        }
                      }}
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
              disabled={saving || !name.trim() || (!waBody && !emailBody)}
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
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widests text-navy-light/60 font-display">
              Vista previa
            </p>
            {channel === 'both' && (
              <div className="flex gap-1">
                {(['whatsapp', 'email'] as const).map(ch => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setPreviewChannel(ch)}
                    className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium transition-all font-display', previewChannel === ch ? 'bg-navy text-white' : 'text-navy-light/60')}
                  >
                    {ch === 'whatsapp' ? 'WhatsApp' : 'Email'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {(channel === 'whatsapp' || (channel === 'both' && previewChannel === 'whatsapp')) && (
            <WhatsAppPreview fromName="Theos Place" body={waBody || 'El mensaje aparecerá aquí...'} />
          )}
          {(channel === 'email' || (channel === 'both' && previewChannel === 'email')) && (
            <EmailPreview subject={subject} body={emailBody || 'El mensaje aparecerá aquí...'} />
          )}
        </div>
      </div>
    </div>
  )
}
