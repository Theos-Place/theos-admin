'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useServers } from '@/hooks/useServers'
import { useToast } from '@/components/shared/Toast'
import { cn } from '@/lib/utils'
import { ChevronLeft, Check, Clock } from 'lucide-react'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'
const labelCls = 'text-[11px] tracking-widest uppercase text-navy-light/60 font-display'

function SolicitarPuestoContent() {
  const params = useSearchParams()
  const router = useRouter()
  const { committees: allCommittees } = useServers()
  const toast = useToast()

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

  const [committeeId, setCommitteeId] = useState(params.get('comite') ?? '')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [functions, setFunctions] = useState('')
  const [profile, setProfile] = useState('')
  const [studyReq, setStudyReq] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const valid = committeeId !== '' && title.trim().length > 0

  async function submit() {
    if (!valid || saving) return
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/servers/position-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          committee_id: committeeId,
          title: title.trim(),
          description: description.trim() || null,
          functions: functions.trim() || null,
          profile: profile.trim() || null,
          study_requirement: studyReq.trim() || null,
        }),
      })
      if (!res.ok) { const b = await res.json().catch(() => null); throw new Error(b?.error || 'No se pudo enviar la solicitud') }
      setDone(true); toast('Solicitud enviada', 'success')
      setTimeout(() => router.push('/servidores/vacantes'), 1400)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      setError(msg); toast(msg, 'error'); setSaving(false)
    }
  }

  if (done) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <div className="text-center space-y-3 max-w-sm">
          <div className="h-14 w-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto"><Clock size={24} className="text-amber-700" /></div>
          <p className="text-xl font-bold text-navy font-display">Solicitud enviada</p>
          <p className="text-sm text-navy-light/60 font-body">Staff revisará tu solicitud. Cuando la aprueben, el puesto quedará disponible para solicitarle vacantes.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/servidores/vacantes" className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors font-body">
          <ChevronLeft size={16} /> Puestos de Servicio
        </Link>
        <span className="text-navy-light/60">|</span>
        <span className="text-sm font-semibold text-navy font-display">Solicitar puesto nuevo</span>
      </div>

      <div className="rounded-2xl px-4 py-3 bg-amber-50 border border-amber-200">
        <p className="text-[12px] text-amber-800 font-body">
          Esto crea una solicitud que <strong>Staff debe aprobar</strong>. Al aprobarla, el puesto se agrega al catálogo. Si el puesto ya existe, mejor <Link href="/servidores/vacantes/nueva" className="underline">solicitá una vacante</Link>.
        </p>
      </div>

      <div className="rounded-2xl p-5 space-y-5 bg-surface-card shadow-[var(--shadow-md)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className={labelCls}>Comité</label>
            <select className={inputCls} value={committeeId} onChange={e => setCommitteeId(e.target.value)}>
              <option value="">Seleccionar comité…</option>
              {committees.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Nombre del puesto</label>
            <input className={inputCls} placeholder="Ej. Colaborador de Bienvenida" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <label className={labelCls}>Nivel de estudio requerido</label>
          <input className={inputCls} placeholder="Ej. Discípulos 2" value={studyReq} onChange={e => setStudyReq(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className={labelCls}>Descripción</label>
          <textarea className={cn(inputCls, 'resize-y')} rows={2} value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className={labelCls}>Funciones (una por línea, con •)</label>
          <textarea className={cn(inputCls, 'resize-y')} rows={6} placeholder={'• …\n• …'} value={functions} onChange={e => setFunctions(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className={labelCls}>Perfil (una por línea, con •)</label>
          <textarea className={cn(inputCls, 'resize-y')} rows={6} placeholder={'• …\n• …'} value={profile} onChange={e => setProfile(e.target.value)} />
        </div>

        {error && <p className="text-sm text-coral font-body">{error}</p>}

        <div className="flex items-center justify-end gap-3 pt-1 border-t border-[var(--outline-variant)]">
          <button type="button" onClick={submit} disabled={!valid || saving}
            className={cn('rounded-full px-5 py-2.5 text-sm text-white transition-colors font-body', valid && !saving ? 'bg-coral hover:bg-coral-deep' : 'bg-navy-light/20 cursor-not-allowed')}>
            {saving ? 'Enviando…' : 'Enviar solicitud'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SolicitarPuestoPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-[var(--fg-muted)]">Cargando…</div>}>
      <SolicitarPuestoContent />
    </Suspense>
  )
}
