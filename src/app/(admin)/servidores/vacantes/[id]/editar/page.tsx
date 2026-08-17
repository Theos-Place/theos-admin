'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useServers } from '@/hooks/useServers'
import { useToast } from '@/components/shared/Toast'
import { Check } from 'lucide-react'

export default function EditarVacantePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { vacancies, loading } = useServers('vacancies')
  const toast = useToast()
  const vacancy = useMemo(() => vacancies.find(v => v.id === id), [vacancies, id])

  // Solo logística de la vacante. Descripción/funciones/perfil viven en el PUESTO.
  const [schedule, setSchedule]     = useState('')
  const [commitment, setCommitment] = useState('')
  const [slotsTotal, setSlotsTotal] = useState('1')
  const [expiresAt, setExpiresAt]   = useState('')
  const [location, setLocation]     = useState('')
  const [notes, setNotes]           = useState('')
  const [featured, setFeatured]     = useState(false)
  const [saved, setSaved]           = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)

  useEffect(() => {
    if (!vacancy) return
    setSchedule(vacancy.schedule)
    setCommitment(vacancy.commitment)
    setSlotsTotal(String(vacancy.slots_total))
    setExpiresAt(vacancy.expires_at?.slice(0, 10) ?? '')
    setLocation(vacancy.location ?? '')
    setNotes(vacancy.notes ?? '')
    setFeatured(!!vacancy.is_featured)
  }, [vacancy])

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/servers/vacancies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule: schedule.trim() || null,
          commitment: commitment.trim() || null,
          slots_total: Math.max(1, Number(slotsTotal) || 1),
          expires_at: expiresAt || null,
          location: location.trim() || null,
          notes: notes.trim() || null,
          is_featured: featured,
        }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => null)
        throw new Error(b?.error || 'No se pudieron guardar los cambios')
      }
      toast('Cambios guardados', 'success')
      setSaved(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      setError(msg)
      toast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !vacancy) {
    return <div className="flex items-center justify-center min-h-60"><p className="text-sm text-navy-light/70 font-body">Cargando vacante...</p></div>
  }
  if (!vacancy) {
    return <div className="flex items-center justify-center min-h-60"><p className="text-sm text-navy-light/70 font-body">Vacante no encontrada.</p></div>
  }
  if (saved) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <div className="text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-teal-soft/30 flex items-center justify-center mx-auto"><Check size={24} className="text-teal-deep" /></div>
          <p className="text-xl font-bold text-navy font-display">Cambios guardados</p>
          <button onClick={() => router.push(`/servidores/vacantes/${id}`)} className="inline-block rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body">Ver vacante</button>
        </div>
      </div>
    )
  }

  const inputCls = 'form-input'
  const desc = vacancy.position_description
  const funcs = vacancy.position_functions
  const profile = vacancy.position_profile
  const skills = vacancy.position_skills
  const nivel = vacancy.position_study_requirement

  return (
    <div className="page">
      <div className="ph">
        <button className="btn btn-ghost btn-sm mb-[10px]" onClick={() => router.push(`/servidores/vacantes/${id}`)}>← Volver a la vacante</button>
        <div className="ph-row">
          <div>
            <div className="ptitle">Editar vacante</div>
            <div className="psub">{vacancy.title} · {vacancy.committee_name}</div>
          </div>
          <div className="ph-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => router.push(`/servidores/vacantes/${id}`)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-coral font-body mb-2">{error}</p>}

      {/* Contenido del PUESTO (solo lectura): para cambiarlo, editá el puesto. */}
      {(desc || funcs || profile || skills || nivel) && (
        <div className="card py-4 px-[22px] mb-3">
          <p className="text-[11px] uppercase tracking-widest text-navy-light/70 font-display mb-2">Del puesto (no editable acá)</p>
          <div className="space-y-3">
            {nivel && <p className="text-[12px] text-navy-light/80 font-body"><span className="font-semibold text-navy">Nivel:</span> {nivel}</p>}
            {desc && <div><p className="text-[12px] font-semibold text-navy font-display">Descripción</p><p className="text-[13px] text-navy-light/80 font-body whitespace-pre-line">{desc}</p></div>}
            {funcs && <div><p className="text-[12px] font-semibold text-navy font-display">Funciones</p><p className="text-[13px] text-navy-light/80 font-body whitespace-pre-line leading-relaxed">{funcs}</p></div>}
            {profile && <div><p className="text-[12px] font-semibold text-navy font-display">Perfil</p><p className="text-[13px] text-navy-light/80 font-body whitespace-pre-line leading-relaxed">{profile}</p></div>}
            {skills && <div><p className="text-[12px] font-semibold text-navy font-display">Habilidades</p><p className="text-[13px] text-navy-light/80 font-body whitespace-pre-line leading-relaxed">{skills}</p></div>}
          </div>
        </div>
      )}

      {/* Logística de la vacante (editable) */}
      <div className="card py-5 px-[22px]">
        <div className="flex flex-col gap-4">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Horario</label>
              <input aria-label="Horario" className={inputCls} value={schedule} onChange={e => setSchedule(e.target.value)} placeholder="Ej. Domingos 8am – 12pm" />
            </div>
            <div className="form-group">
              <label className="form-label">Compromiso</label>
              <input aria-label="Compromiso" className={inputCls} value={commitment} onChange={e => setCommitment(e.target.value)} placeholder="Ej. 4 horas semanales" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Cupos disponibles</label>
              <input type="number" min="1" max="50" aria-label="Cupos disponibles" className={inputCls} value={slotsTotal} onChange={e => setSlotsTotal(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Ubicación / sede</label>
              <input aria-label="Ubicación" className={inputCls} value={location} onChange={e => setLocation(e.target.value)} placeholder="Sede / lugar (opcional)" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Expira</label>
              <input type="date" aria-label="Expira" className={inputCls} value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
            </div>
            <div className="form-group flex items-end">
              <label className="flex items-center gap-2 cursor-pointer pb-2">
                <input type="checkbox" className="accent-coral" checked={featured} onChange={e => setFeatured(e.target.checked)} />
                <span className="text-sm text-navy font-body">Destacada</span>
              </label>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Justificación / notas internas</label>
            <textarea aria-label="Notas" className="form-textarea" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas internas (opcional)" />
          </div>
        </div>
      </div>
    </div>
  )
}
