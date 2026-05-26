'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Copy, Check, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MOCK_SAVE_DELAY_MS } from '@/lib/constants'

const EVENT_TYPE_OPTIONS = [
  { id: 'charla', label: 'Charlas' },
  { id: 'campamento', label: 'Campamentos' },
  { id: 'social', label: 'Actividades Sociales' },
  { id: 'capacitacion', label: 'Capacitaciones' },
]

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'
const labelCls = 'text-[11px] tracking-widest uppercase text-navy-light/40'

export default function EmbedPage() {
  const [cfg, setCfg] = useState({
    view: 'list' as 'monthly' | 'weekly' | 'list',
    types: ['charla', 'campamento', 'social', 'capacitacion'] as string[],
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
  const [codeTab, setCodeTab] = useState<'iframe' | 'js' | 'react'>('iframe')
  const [copied, setCopied] = useState(false)

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
  src="https://admin.theosplace.org/calendario-publico?view=${cfg.view}&types=${cfg.types.join(',')}&primary=%23${cfg.primary.slice(1)}&accent=%23${cfg.accent.slice(1)}&lang=${cfg.lang}"
  width="100%"
  height="${cfg.height}px"
  frameborder="0"
  style="border-radius: 12px; border: 1px solid #e4e6ee;"
  title="Calendario Theos Place"
></iframe>`

  const jsCode = `<!-- Calendario Theos Place -->
<div id="theos-calendar"></div>
<script>
  window.TheosCalendarConfig = {
    container: '#theos-calendar',
    view: '${cfg.view}',
    types: ${JSON.stringify(cfg.types)},
    colors: { primary: '${cfg.primary}', accent: '${cfg.accent}', background: '${cfg.bg}' },
    showDescription: ${cfg.showDesc},
    showLocation: ${cfg.showLoc},
    showRegistrationButton: ${cfg.showBtn},
    language: '${cfg.lang}',
    height: '${cfg.height}px'
  };
<\/script>
<script src="https://admin.theosplace.org/embed/calendar.js" async><\/script>`

  const reactCode = `import { TheosCalendar } from '@theosplace/calendar-widget'

export default function MiPagina() {
  return (
    <TheosCalendar
      view="${cfg.view}"
      types={${JSON.stringify(cfg.types)}}
      colors={{ primary: '${cfg.primary}', accent: '${cfg.accent}' }}
      showRegistrationButton={${cfg.showBtn}}
      language="${cfg.lang}"
      height="${cfg.height}px"
    />
  )
}`

  const codeMap = { iframe: iframeCode, js: jsCode, react: reactCode }
  const currentCode = codeMap[codeTab]

  function handleCopy() {
    navigator.clipboard.writeText(currentCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), MOCK_SAVE_DELAY_MS)
    })
  }

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <Link href="/eventos" className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors" style={{ fontFamily: 'var(--font-body)' }}>
        <ChevronLeft size={16} /> Eventos
      </Link>

      <div className="rounded-2xl bg-navy px-6 py-5" style={{ boxShadow: 'var(--shadow-md)' }}>
        <h1 className="text-2xl text-white" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}>
          Compartir calendario
        </h1>
        <p className="mt-1 text-sm text-white/50" style={{ fontFamily: 'var(--font-body)' }}>
          Generá el código para embeber el calendario de eventos en tu sitio web o app.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        {/* Left: Configurator */}
        <div className="rounded-2xl p-5 space-y-5 overflow-y-auto" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)', maxHeight: '80vh' }}>
          <h2 className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
            Configuración
          </h2>

          {/* Vista */}
          <div className="space-y-2">
            <label className={labelCls} style={{ fontFamily: 'var(--font-display)' }}>Vista</label>
            <div className="flex gap-2">
              {(['monthly', 'weekly', 'list'] as const).map(v => {
                const labels = { monthly: 'Mensual', weekly: 'Semanal', list: 'Lista' }
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCfg(prev => ({ ...prev, view: v }))}
                    className={cn(
                      'flex-1 rounded-xl border py-2 text-[12px] font-medium transition-all',
                      cfg.view === v
                        ? 'border-coral bg-coral/5 text-coral'
                        : 'text-navy-light/60 hover:bg-surface-low'
                    )}
                    style={{ borderColor: cfg.view === v ? undefined : 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                  >
                    {labels[v]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tipos de evento */}
          <div className="space-y-2">
            <label className={labelCls} style={{ fontFamily: 'var(--font-display)' }}>Tipos de evento</label>
            <div className="space-y-2">
              {EVENT_TYPE_OPTIONS.map(t => (
                <label key={t.id} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-coral"
                    checked={cfg.types.includes(t.id)}
                    onChange={() => toggleType(t.id)}
                  />
                  <span className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>{t.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Colores */}
          <div className="space-y-2">
            <label className={labelCls} style={{ fontFamily: 'var(--font-display)' }}>Colores</label>
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
                    <p className="text-[11px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>{label}</p>
                    <p className="text-[12px] text-navy font-mono">{cfg[key]}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const defaults = { primary: '#161440', accent: '#EF5554', bg: '#FFFFFF' }
                      setCfg(prev => ({ ...prev, [key]: defaults[key] }))
                    }}
                    className="text-[10px] text-navy-light/40 hover:text-navy transition-colors"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    reset
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Opciones */}
          <div className="space-y-2">
            <label className={labelCls} style={{ fontFamily: 'var(--font-display)' }}>Opciones</label>
            <div className="space-y-2">
              {[
                { key: 'showDesc' as const, label: 'Mostrar descripción' },
                { key: 'showLoc' as const, label: 'Mostrar ubicación' },
                { key: 'showBtn' as const, label: 'Mostrar botón de inscripción' },
                { key: 'showPast' as const, label: 'Mostrar eventos pasados' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-coral"
                    checked={cfg[key]}
                    onChange={e => setCfg(prev => ({ ...prev, [key]: e.target.checked }))}
                  />
                  <span className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Altura */}
          <div className="space-y-2">
            <label className={labelCls} style={{ fontFamily: 'var(--font-display)' }}>Altura del widget</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={cfg.height}
                onChange={e => setCfg(prev => ({ ...prev, height: e.target.value }))}
                className={cn(inputCls, 'flex-1')}
                style={{ fontFamily: 'var(--font-body)' }}
                min={300}
                max={1200}
                step={50}
              />
              <span className="text-sm text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>px</span>
            </div>
          </div>
        </div>

        {/* Right: Preview + Code */}
        <div className="space-y-4">
          {/* Preview */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--outline-variant)' }}>
              <span className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
                Vista previa
              </span>
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12px] text-coral hover:text-coral-deep transition-colors"
                style={{ fontFamily: 'var(--font-body)' }}
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
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--outline-variant)' }}>
              <div className="flex gap-1">
                {(['iframe', 'js', 'react'] as const).map(tab => {
                  const labels = { iframe: 'iFrame', js: 'JavaScript', react: 'React' }
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setCodeTab(tab)}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all',
                        codeTab === tab
                          ? 'bg-navy text-white'
                          : 'text-navy-light/60 hover:bg-surface-low'
                      )}
                      style={{ fontFamily: 'var(--font-body)' }}
                    >
                      {labels[tab]}
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all',
                  copied
                    ? 'bg-teal-soft/20 text-teal-deep'
                    : 'bg-surface-low text-navy-light/60 hover:text-navy'
                )}
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <pre
              className="p-4 text-[12px] leading-relaxed overflow-x-auto"
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                background: 'var(--surface-low)',
                color: 'var(--navy)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {currentCode}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
