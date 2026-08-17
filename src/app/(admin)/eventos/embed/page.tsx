'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ChevronLeft, Copy, Check, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEventTypes } from '@/hooks/useEventTypes'
import { useAuth } from '@/hooks/useAuth'
import { eventPageActions } from '@/lib/events/page-actions'
import { AccessDenied } from '@/components/shared/AccessDenied'
import { MOCK_SAVE_DELAY_MS } from '@/lib/constants'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'
const labelCls = 'text-[12px] tracking-widest uppercase text-navy-light/70'

export default function EmbedPage() {
  // EVE-3: compartir/embeber el calendario es SOLO admin y comunicaciones —
  // antes cualquier rol con el módulo eventos entraba por URL directa.
  const { user, loaded } = useAuth()
  const { share } = eventPageActions(user?.roles ?? [])
  // Tipos desde la BD (no mock): los checkboxes reflejan el catálogo real.
  const eventTypes = useEventTypes()
  const [cfg, setCfg] = useState({
    view: 'monthly' as 'monthly' | 'weekly' | 'list' | 'grid',
    types: [] as string[],
    primary: '#161440',
    accent: '#EF5554',
    bg: '#FFFFFF',
    showDesc: true,
    showLoc: true,
    showBtn: true,
    showPast: false,
    lang: 'es',
    height: '600',
  })
  const [copied, setCopied] = useState(false)

  // Al cargar los tipos, seleccionar todos por defecto (una vez).
  const typesInit = useRef(false)
  useEffect(() => {
    if (typesInit.current || eventTypes.length === 0) return
    typesInit.current = true
    setCfg(prev => ({ ...prev, types: eventTypes.map(t => t.id) }))
  }, [eventTypes])

  // El gate va DESPUÉS de todos los hooks (rules-of-hooks).
  if (loaded && !share) return <AccessDenied />

  function toggleType(id: string) {
    setCfg(prev => ({
      ...prev,
      types: prev.types.includes(id)
        ? prev.types.filter(t => t !== id)
        : [...prev.types, id],
    }))
  }

  const previewUrl = `/calendario?view=${cfg.view}&types=${cfg.types.join(',')}&primary=${encodeURIComponent(cfg.primary)}&accent=${encodeURIComponent(cfg.accent)}&bg=${encodeURIComponent(cfg.bg)}&showDesc=${cfg.showDesc}&showLoc=${cfg.showLoc}&showBtn=${cfg.showBtn}`

  const iframeCode = `<!-- Calendario Theos Place -->
<iframe
  src="https://admin.theosplace.org/calendario?view=${cfg.view}&types=${cfg.types.join(',')}&primary=%23${cfg.primary.slice(1)}&accent=%23${cfg.accent.slice(1)}&lang=${cfg.lang}"
  width="100%"
  height="${cfg.height}px"
  frameborder="0"
  style="border-radius: 12px; border: 1px solid #e4e6ee;"
  title="Calendario Theos Place"
></iframe>`

  const currentCode = iframeCode

  function handleCopy() {
    navigator.clipboard.writeText(currentCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), MOCK_SAVE_DELAY_MS)
    })
  }

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <Link href="/eventos" className="flex items-center gap-1 text-sm text-navy-light/70 hover:text-navy transition-colors font-body">
        <ChevronLeft size={16} /> Eventos
      </Link>

      <div className="rounded-2xl bg-navy px-6 py-5 shadow-[var(--shadow-md)]">
        <h1 className="text-2xl text-white font-display font-extrabold tracking-[-0.02em]">
          Compartir calendario
        </h1>
        <p className="mt-1 text-sm text-white/70 font-body">
          Generá el código para embeber el calendario de eventos en tu sitio web o app.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        {/* Left: Configurator */}
        <div className="rounded-2xl p-5 space-y-5 overflow-y-auto bg-surface-card shadow-[var(--shadow-md)] max-h-[80vh]">
          <h2 className="text-[12px] tracking-widest uppercase text-navy-light/70 font-display">
            Configuración
          </h2>

          {/* Vista */}
          <div className="space-y-2">
            <label className={`${labelCls} font-display`}>Vista</label>
            <div className="flex gap-2">
              {(['monthly', 'weekly', 'list', 'grid'] as const).map(v => {
                const labels = { monthly: 'Mensual', weekly: 'Semanal', list: 'Lista', grid: 'Cuadrícula' }
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCfg(prev => ({ ...prev, view: v }))}
                    className={cn(
                      'flex-1 rounded-xl border py-2 text-[12px] font-medium transition-all',
                      cfg.view === v
                        ? 'border-coral bg-coral/5 text-coral'
                        : 'text-navy-light/70 hover:bg-surface-low',
                      'font-body'
                    )}
                    style={{ borderColor: cfg.view === v ? undefined : 'var(--outline-variant)' }}
                  >
                    {labels[v]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tipos de evento */}
          <div className="space-y-2">
            <label className={`${labelCls} font-display`}>Tipos de evento</label>
            <div className="space-y-2">
              {eventTypes.map(t => (
                <label key={t.id} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-coral"
                    checked={cfg.types.includes(t.id)}
                    onChange={() => toggleType(t.id)}
                  />
                  <span className="text-sm text-navy font-body">{t.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Colores */}
          <div className="space-y-2">
            <label className={`${labelCls} font-display`}>Colores</label>
            <div className="space-y-2.5">
              {[
                { key: 'primary' as const, label: 'Color primario' },
                { key: 'accent' as const, label: 'Color de acento' },
                { key: 'bg' as const, label: 'Fondo' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <input
                    type="color"
                    value={cfg[key]}
                    onChange={e => setCfg(prev => ({ ...prev, [key]: e.target.value }))}
                    className="h-8 w-8 rounded-lg cursor-pointer border-0 bg-transparent"
                  />
                  <div className="flex-1">
                    <p className="text-[12px] text-navy-light/70 font-body">{label}</p>
                    <p className="text-[12px] text-navy font-mono">{cfg[key]}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const defaults = { primary: '#161440', accent: '#EF5554', bg: '#FFFFFF' }
                      setCfg(prev => ({ ...prev, [key]: defaults[key] }))
                    }}
                    className="text-[11px] text-navy-light/70 hover:text-navy transition-colors font-body"
                  >
                    restablecer
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Opciones */}
          <div className="space-y-2">
            <label className={`${labelCls} font-display`}>Opciones</label>
            <div className="space-y-2">
              {[
                { key: 'showDesc' as const, label: 'Mostrar descripción' },
                { key: 'showLoc' as const, label: 'Mostrar ubicación' },
                { key: 'showBtn' as const, label: 'Mostrar botón de inscripción' },
                // 'Mostrar eventos pasados' se quitó: no afectaba ni el preview ni el código.
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-coral"
                    checked={cfg[key]}
                    onChange={e => setCfg(prev => ({ ...prev, [key]: e.target.checked }))}
                  />
                  <span className="text-sm text-navy font-body">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Altura */}
          <div className="space-y-2">
            <label className={`${labelCls} font-display`}>Altura del widget</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={cfg.height}
                onChange={e => setCfg(prev => ({ ...prev, height: e.target.value }))}
                className={cn(inputCls, 'flex-1', 'font-body')}
                min={300}
                max={1200}
                step={50}
              />
              <span className="text-sm text-navy-light/70 font-body">px</span>
            </div>
          </div>
        </div>

        {/* Right: Preview + Code */}
        <div className="space-y-4">
          {/* Preview */}
          <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-b-[var(--outline-variant)]">
              <span className="text-[12px] tracking-widest uppercase text-navy-light/70 font-display">
                Vista previa
              </span>
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12px] text-coral hover:text-coral-deep transition-colors font-body"
              >
                <ExternalLink size={12} />
                Abrir en nueva pestaña
              </a>
            </div>
            <iframe
              src={previewUrl}
              width="100%"
              height={cfg.height + 'px'}
              className="border-0"
              title="Vista previa del calendario"
            />
          </div>

          {/* Generated code */}
          <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-b-[var(--outline-variant)]">
              {/* Solo iFrame: los snippets de JavaScript/React referenciaban
                  calendar.js y @theosplace/calendar-widget, que no existen. */}
              <span className="rounded-lg px-3 py-1.5 text-[12px] font-medium bg-navy text-white font-body">iFrame</span>
              <button
                type="button"
                onClick={handleCopy}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all',
                  copied
                    ? 'bg-teal-soft/20 text-teal-deep'
                    : 'bg-surface-low text-navy-light/70 hover:text-navy',
                  'font-body'
                )}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <pre
              className="p-4 text-[12px] leading-relaxed overflow-x-auto font-[var(--font-mono,monospace)] bg-surface-low text-[var(--navy)] whitespace-pre-wrap break-all"
            >
              {currentCode}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
