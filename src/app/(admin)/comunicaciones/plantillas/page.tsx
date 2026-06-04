'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type MessageTemplate, type CommunicationChannel } from '@/data/mock-communications'
import { useCommunications } from '@/hooks/useCommunications'
import { TemplateCard } from '@/components/communications/TemplateCard'
import { cn } from '@/lib/utils'
import { Plus, FileText } from 'lucide-react'

type CategoryFilter = 'all' | MessageTemplate['category']

const CATEGORY_FILTERS: { key: CategoryFilter; label: string }[] = [
  { key: 'all',          label: 'Todas' },
  { key: 'bienvenida',   label: 'Bienvenida' },
  { key: 'recordatorio', label: 'Recordatorio' },
  { key: 'inscripcion',  label: 'Inscripción' },
  { key: 'cancelacion',  label: 'Cancelación' },
  { key: 'general',      label: 'General' },
]

const CHANNEL_FILTERS: { key: 'all' | CommunicationChannel; label: string }[] = [
  { key: 'all',       label: 'Canal: Todos' },
  { key: 'whatsapp',  label: 'WhatsApp' },
  { key: 'email',     label: 'Email' },
  { key: 'both',      label: 'Ambos' },
]

export default function PlantillasPage() {
  const router = useRouter()
  const { templates: allTemplates } = useCommunications()
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  useEffect(() => { setTemplates(allTemplates) }, [allTemplates])
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [channelFilter, setChannelFilter] = useState<'all' | CommunicationChannel>('all')

  const filtered = useMemo(() => {
    return templates.filter(t => {
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false
      if (channelFilter !== 'all' && t.channel !== channelFilter) return false
      return true
    })
  }, [templates, categoryFilter, channelFilter])

  function handleDuplicate(t: MessageTemplate) {
    const clone: MessageTemplate = {
      ...t,
      id: `tpl-${Date.now()}`,
      name: `${t.name} (copia)`,
      used_count: 0,
      created_at: new Date().toISOString(),
    }
    setTemplates(prev => [...prev, clone])
  }

  function handleDelete(t: MessageTemplate) {
    setTemplates(prev => prev.filter(p => p.id !== t.id))
  }

  function handleUse(t: MessageTemplate) {
    const channel = t.channel === 'both' ? 'both' : t.channel
    router.push(`/comunicaciones/nueva?template=${t.id}&channel=${channel}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className="rounded-2xl bg-navy px-6 py-5 flex items-start justify-between gap-4"
        style={{ boxShadow: 'var(--shadow-md)' }}
      >
        <div>
          <h1 className="text-2xl text-white" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Plantillas
          </h1>
          <p className="mt-1 text-sm text-white/50" style={{ fontFamily: 'var(--font-body)' }}>
            {templates.filter(t => t.is_active).length} plantillas activas
          </p>
        </div>
        <Link
          href="/comunicaciones/plantillas/nueva"
          className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-all shrink-0"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          <Plus size={14} />
          Nueva plantilla
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5 flex-wrap flex-1">
          {CATEGORY_FILTERS.map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setCategoryFilter(f.key)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-[12px] font-medium border transition-all',
                categoryFilter === f.key
                  ? 'bg-navy text-white border-navy'
                  : 'text-navy-light/60 hover:text-navy hover:bg-surface-low border-transparent'
              )}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          className="rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 self-start"
          style={{ fontFamily: 'var(--font-body)' }}
          value={channelFilter}
          onChange={e => setChannelFilter(e.target.value as 'all' | CommunicationChannel)}
        >
          {CHANNEL_FILTERS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl py-16 flex flex-col items-center gap-3" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
          <FileText size={28} className="text-navy-light/20" />
          <p className="text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>No hay plantillas con ese filtro.</p>
          <Link
            href="/comunicaciones/plantillas/nueva"
            className="rounded-full border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            Crear primera plantilla
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(t => (
            <TemplateCard
              key={t.id}
              template={t}
              onUse={handleUse}
              onEdit={() => {}}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
