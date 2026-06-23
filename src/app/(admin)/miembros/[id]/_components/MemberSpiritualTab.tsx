'use client'

import { useState, useEffect } from 'react'
import { Check, Loader2, Sparkles } from 'lucide-react'

type Spiritual = {
  baptism_date: string | null
  baptism_place: string | null
  spiritual_gifts: string | null
}

/** Tab "Espiritual": datos de member_spiritual_data. Editable por el propio
 *  miembro (su fila) y por roles administrativos. La autorización real vive en
 *  la API + RLS; acá solo se edita y guarda. */
export function MemberSpiritualTab({ memberId }: { memberId: string }) {
  const [data, setData] = useState<Spiritual | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let alive = true
    fetch(`/api/members/${memberId}/spiritual`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: Spiritual) => { if (alive) { setData(d); setError(false) } })
      .catch(() => { if (alive) setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [memberId])

  function set<K extends keyof Spiritual>(key: K, value: Spiritual[K]) {
    setData(prev => (prev ? { ...prev, [key]: value } : prev))
    setSaved(false)
  }

  async function save() {
    if (!data || saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/members/${memberId}/spiritual`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      setSaved(true)
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  const labelCls = 'text-[11px] uppercase tracking-wider text-navy-light/70 mb-1 block font-display'
  const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'

  if (loading) {
    return <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]"><div className="h-40 rounded-xl bg-surface-low animate-pulse" /></div>
  }
  if (error && !data) {
    return (
      <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]">
        <p className="text-sm text-coral font-body">No se pudieron cargar los datos espirituales.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-5">
      <div className="flex items-center gap-2">
        <Sparkles size={15} className="text-teal-deep" />
        <p className="text-[10px] uppercase tracking-wider text-navy-light/70 font-display">Datos espirituales</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Fecha de bautizo</label>
          <input type="date" className={inputCls} value={data?.baptism_date ?? ''} onChange={e => set('baptism_date', e.target.value || null)} />
        </div>
        <div>
          <label className={labelCls}>Lugar de bautizo</label>
          <input type="text" className={inputCls} placeholder="ej. Theos Place, San José" value={data?.baptism_place ?? ''} onChange={e => set('baptism_place', e.target.value)} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Dones espirituales</label>
        <textarea rows={4} className={`${inputCls} resize-none`} placeholder="Dones, talentos o áreas de servicio…" value={data?.spiritual_gifts ?? ''} onChange={e => set('spiritual_gifts', e.target.value)} />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-50 font-body"
        >
          {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : saved ? <><Check size={14} /> Guardado</> : 'Guardar'}
        </button>
        {error && data && <span className="text-[12px] text-coral font-body">No se pudo guardar. Intentá de nuevo.</span>}
      </div>
    </div>
  )
}
