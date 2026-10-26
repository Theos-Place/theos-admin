'use client'

import { useState, useEffect } from 'react'
import { Check, Loader2, Sparkles } from 'lucide-react'

import { PerfilSirve } from '@/components/members/PerfilSirve'

import { DatePicker } from '@/components/events/DatePicker'
type Spiritual = {
  baptism_date: string | null
  baptism_place: string | null
}

/** Tab "Espiritual": datos de member_spiritual_data. El bautismo lo edita el
 *  propio miembro (su fila) y los roles administrativos. Debajo, el perfil
 *  S.I.R.V.E. (SRV-20): lo edita solo la persona; los roles de lectura lo
 *  ven, y a los demás la API no se lo manda. La autorización real vive en la
 *  API; acá solo se edita y guarda. */
/** `onActualizado`: la Profesión del S.I.R.V.E. es `members.occupation`; al
 *  guardarla hay que refrescar la ficha o Info Personal sigue mostrando lo
 *  viejo hasta recargar (visto en staging, 2026-10-21). */
export function MemberSpiritualTab({ memberId, onActualizado }: { memberId: string; onActualizado?: () => void }) {
  const [data, setData] = useState<Spiritual | null>(null)
  const [loading, setLoading] = useState(true)
  // El mensaje y no un booleano: un 403 y una caída se arreglan distinto.
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let alive = true
    fetch(`/api/members/${memberId}/spiritual`)
      .then(async r => {
        if (!r.ok) {
          const { mensajeDeLaRespuesta } = await import('@/lib/api/mensaje-del-error')
          throw new Error(await mensajeDeLaRespuesta(r, 'No se pudieron cargar los datos espirituales.'))
        }
        return r.json()
      })
      .then((d: Spiritual) => { if (alive) { setData({ baptism_date: d.baptism_date, baptism_place: d.baptism_place }); setError(null) } })
      .catch((e: Error) => { if (alive) setError(e.message || 'No se pudieron cargar los datos espirituales.') })
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
      if (!res.ok) {
        const { mensajeDeLaRespuesta } = await import('@/lib/api/mensaje-del-error')
        throw new Error(await mensajeDeLaRespuesta(res, 'No se pudieron guardar los datos espirituales.'))
      }
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error && e.message
        ? e.message
        : 'No se pudieron guardar los datos espirituales.')
    } finally {
      setSaving(false)
    }
  }

  const labelCls = 'text-[13px] uppercase tracking-wider text-navy-light/80 mb-1 block font-display'
  const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'

  if (loading) {
    return <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]"><div className="h-40 rounded-xl bg-surface-low animate-pulse" /></div>
  }
  if (error && !data) {
    return (
      <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]">
        <p className="text-sm text-coral-deep font-body">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
    <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-5">
      <div className="flex items-center gap-2">
        <Sparkles size={15} className="text-teal-deep" />
        <p className="text-[11px] uppercase tracking-wider text-navy-light/80 font-display">Bautismo</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="fecha-de-bautizo" className={labelCls}>Fecha de bautizo</label>
          <DatePicker id="fecha-de-bautizo" className={inputCls} value={data?.baptism_date ?? ''} onChange={v => set('baptism_date', v || null)} />
        </div>
        <div>
          <label htmlFor="lugar-de-bautizo" className={labelCls}>Lugar de bautizo</label>
          <input id="lugar-de-bautizo" type="text" className={inputCls} placeholder="ej. Theos Place, San José" value={data?.baptism_place ?? ''} onChange={e => set('baptism_place', e.target.value)} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-full bg-coral shadow-[var(--shadow-pulse-sm)] px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-50 font-body"
        >
          {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : saved ? <><Check size={14} /> Guardado</> : 'Guardar'}
        </button>
        {error && data && <span className="text-[13px] text-coral-deep font-body">No se pudo guardar. Intentá de nuevo.</span>}
      </div>
    </div>

    {/* SRV-20 · Los dones viven acá, en el perfil S.I.R.V.E. (no se repiten). */}
    <PerfilSirve memberId={memberId} onActualizado={onActualizado} />
    </div>
  )
}
