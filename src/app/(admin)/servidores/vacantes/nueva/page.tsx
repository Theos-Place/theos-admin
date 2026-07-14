'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useServers } from '@/hooks/useServers'
import { useToast } from '@/components/shared/Toast'
import { cn } from '@/lib/utils'
import { ChevronLeft, Check, FilePlus2 } from 'lucide-react'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'
const labelCls = 'text-[11px] tracking-widest uppercase text-navy-light/60 font-display'

function NuevaVacanteContent() {
  const params = useSearchParams()
  const router = useRouter()
  const preselectedCommittee = params.get('comite') ?? ''
  const { committees: allCommittees } = useServers('committees')
  const toast = useToast()

  // El coordinador/líder solo puede solicitar para comités que gestiona; los
  // roles administrativos globales, para cualquiera.
  const [scope, setScope] = useState<{ all: boolean; ids: string[] } | null>(null)
  useEffect(() => {
    let alive = true
    fetch('/api/servers/manageable-committees')
      .then(r => (r.ok ? r.json() : { all: false, ids: [] }))
      .then(d => { if (alive) setScope(d) })
      .catch(() => { if (alive) setScope({ all: false, ids: [] }) })
    return () => { alive = false }
  }, [])
  const committees = scope && !scope.all
    ? allCommittees.filter(c => scope.ids.includes(c.id))
    : allCommittees

  const [committeeId, setCommitteeId] = useState(preselectedCommittee)
  const [positionId, setPositionId]   = useState('')
  const [slots, setSlots]             = useState('1')
  const [schedule, setSchedule]       = useState('')
  const [commitment, setCommitment]   = useState('')
  const [expiresAt, setExpiresAt]     = useState('')
  const [location, setLocation]       = useState('')
  const [notes, setNotes]             = useState('')
  const [featured, setFeatured]       = useState(false)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [done, setDone]               = useState(false)

  const selectedCommittee = committees.find(c => c.id === committeeId)
  const selectedPosition = selectedCommittee?.positions?.find(p => p.id === positionId) ?? null

  const valid = committeeId !== '' && positionId !== '' && Number(slots) >= 1

  async function submit() {
    if (!valid || saving || !selectedPosition) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/servers/vacancies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          committee_id: committeeId,
          position_id: positionId,
          position: selectedPosition.title,
          title: selectedPosition.title,
          // La descripción/funciones/perfil NO se mandan: viven en el puesto y la
          // publicación pública las toma de ahí.
          slots_total: Math.max(1, Number(slots) || 1),
          schedule: schedule.trim() || null,
          commitment: commitment.trim() || null,
          expires_at: expiresAt || null,
          location: location.trim() || null,
          notes: notes.trim() || null,
          is_featured: featured,
          status: 'published',
        }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => null)
        throw new Error(b?.error || 'No se pudo crear la vacante')
      }
      setDone(true)
      toast('Vacante solicitada', 'success')
      setTimeout(() => router.push('/servidores/vacantes'), 1200)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      setError(msg); toast(msg, 'error'); setSaving(false)
    }
  }

  if (done) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <div className="text-center space-y-3">
          <div className="h-14 w-14 rounded-full bg-teal-soft/30 flex items-center justify-center mx-auto"><Check size={24} className="text-teal-deep" /></div>
          <p className="text-xl font-bold text-navy font-display">Vacante solicitada</p>
          <p className="text-sm text-navy-light/60 font-body">Quedó publicada para que los miembros apliquen.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/servidores/vacantes" className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors font-body">
          <ChevronLeft size={16} /> Puestos de Servicio
        </Link>
        <span className="text-navy-light/60">|</span>
        <span className="text-sm font-semibold text-navy font-display">Solicitar vacante</span>
      </div>

      <div className="rounded-2xl p-5 space-y-5 bg-surface-card shadow-[var(--shadow-md)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className={labelCls}>Comité</label>
            <select className={inputCls} value={committeeId} onChange={e => { setCommitteeId(e.target.value); setPositionId('') }}>
              <option value="">Seleccionar comité…</option>
              {committees.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Puesto</label>
            <select className={inputCls} value={positionId} onChange={e => setPositionId(e.target.value)} disabled={!selectedCommittee}>
              <option value="">{selectedCommittee ? 'Seleccionar puesto…' : 'Elegí un comité primero'}</option>
              {selectedCommittee?.positions?.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
        </div>

        {/* Contenido del puesto (solo lectura): viene del catálogo, no se edita acá. */}
        {selectedPosition && (
          <div className="rounded-xl bg-surface-low p-4 space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-navy-light/60 font-display">Del puesto (no editable)</p>
            {selectedPosition.study_requirement && (
              <p className="text-[12px] text-navy-light/80 font-body"><span className="font-semibold text-navy">Nivel:</span> {selectedPosition.study_requirement}</p>
            )}
            {selectedPosition.description && (
              <div><p className="text-[11px] font-semibold text-navy font-display">Descripción</p><p className="text-[13px] text-navy-light/80 font-body whitespace-pre-line">{selectedPosition.description}</p></div>
            )}
            {selectedPosition.functions && (
              <div><p className="text-[11px] font-semibold text-navy font-display">Funciones</p><p className="text-[13px] text-navy-light/80 font-body whitespace-pre-line leading-relaxed">{selectedPosition.functions}</p></div>
            )}
            {selectedPosition.profile && (
              <div><p className="text-[11px] font-semibold text-navy font-display">Perfil</p><p className="text-[13px] text-navy-light/80 font-body whitespace-pre-line leading-relaxed">{selectedPosition.profile}</p></div>
            )}
            {!selectedPosition.description && !selectedPosition.functions && !selectedPosition.profile && (
              <p className="text-[12px] text-navy-light/60 font-body">Este puesto no tiene descripción/funciones/perfil cargados. Editalo en Administración de servidores si querés completarlo.</p>
            )}
          </div>
        )}

        {/* Datos propios de la vacante */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className={labelCls}>Cupos necesarios</label>
            <input type="number" min={1} className={inputCls} value={slots} onChange={e => setSlots(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Ubicación / sede</label>
            <input className={inputCls} placeholder="Sede / lugar (opcional)" value={location} onChange={e => setLocation(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Horario</label>
            <input className={inputCls} placeholder="Ej. Domingos 8am–12pm" value={schedule} onChange={e => setSchedule(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Compromiso esperado</label>
            <input className={inputCls} placeholder="Ej. 2 domingos al mes" value={commitment} onChange={e => setCommitment(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Expira</label>
            <input type="date" className={inputCls} value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 pb-1 self-end cursor-pointer">
            <input type="checkbox" className="accent-coral" checked={featured} onChange={e => setFeatured(e.target.checked)} />
            <span className="text-sm text-navy font-body">Destacada</span>
          </label>
        </div>

        <div className="space-y-1">
          <label className={labelCls}>Justificación / notas internas (opcional)</label>
          <textarea className={cn(inputCls, 'resize-none')} rows={3} placeholder="¿Por qué se necesita?" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        {error && <p className="text-sm text-coral font-body">{error}</p>}

        <div className="flex items-center justify-end gap-3 pt-1 border-t border-[var(--outline-variant)]">
          <button type="button" onClick={submit} disabled={!valid || saving}
            className={cn('rounded-full px-5 py-2.5 text-sm text-white transition-colors font-body', valid && !saving ? 'bg-coral hover:bg-coral-deep' : 'bg-navy-light/20 cursor-not-allowed')}>
            {saving ? 'Solicitando…' : 'Solicitar vacante'}
          </button>
        </div>
      </div>

      <p className="text-[12px] text-navy-light/60 font-body flex items-center gap-1.5">
        <FilePlus2 size={13} /> ¿El puesto no existe todavía?{' '}
        <Link href="/servidores/puestos/solicitar" className="text-coral hover:underline">Solicitá un puesto nuevo</Link>.
      </p>
    </div>
  )
}

export default function NuevaVacantePage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-[var(--fg-muted)]">Cargando…</div>}>
      <NuevaVacanteContent />
    </Suspense>
  )
}
