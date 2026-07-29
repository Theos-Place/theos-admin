'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Loader2, Check, X, Users, MapPin, Clock, Calendar, Home } from 'lucide-react'
import { MemberCombobox, type MemberHit } from '@/components/shared/MemberCombobox'
import { useToast } from '@/components/shared/Toast'

type Req = {
  id: string
  status: 'pago_en_revision' | 'pendiente' | 'grupo_creado' | 'cancelada'
  available_days: string[]; available_times: string[]; zones: string[]
  can_host: boolean; host_address: string | null; host_maps_url: string | null
  ceremony_date: string | null; ceremony_date_defined: boolean; venue_defined: boolean; venue_outside_gam: boolean
  officiant: string | null; comments: string | null
  resulting_group_id: string | null; cancel_reason: string | null
  requester: { id: string; first_name: string; last_name: string } | null
  spouse: { id: string; first_name: string; last_name: string } | null
  payment: { review_status: string | null; status: string | null } | null
  /** PRE-8: la evaluación de cierre dejó a la pareja en seguimiento. */
  needs_follow_up?: boolean
  /** Plan concreto — solo llega a coordinador_estudios/direccion/admin. */
  follow_up_plan?: 'listos' | 'consejeria' | 'posponer' | null
}

const STATUS_LABEL: Record<Req['status'], string> = {
  pago_en_revision: 'Pago en revisión', pendiente: 'Pendiente (armar grupo)', grupo_creado: 'Grupo creado', cancelada: 'Cancelada',
}
const STATUS_STYLE: Record<Req['status'], string> = {
  pago_en_revision: 'bg-amber-100 text-amber-700', pendiente: 'bg-teal/15 text-teal-deep',
  grupo_creado: 'bg-emerald-100 text-emerald-700', cancelada: 'bg-navy/10 text-navy-light/70',
}
const nm = (m: Req['requester']) => m ? `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() : '—'

export function PrematrimonialQueue() {
  const notify = useToast()
  const [items, setItems] = useState<Req[]>([])
  const [loading, setLoading] = useState(true)
  const [panel, setPanel] = useState<{ id: string; mode: 'group' | 'cancel' } | null>(null)
  // form crear grupo
  const [gName, setGName] = useState(''); const [leader, setLeader] = useState<MemberHit | null>(null)
  const [gZone, setGZone] = useState(''); const [gTime, setGTime] = useState(''); const [gStart, setGStart] = useState('')
  const [cancelReason, setCancelReason] = useState(''); const [withRefund, setWithRefund] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/studies/prematrimonial')
      .then(r => r.json()).then(d => setItems(d.items ?? [])).catch(() => setItems([])).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  function openGroup(r: Req) {
    setPanel({ id: r.id, mode: 'group' })
    setGName(`Prematrimonial · ${nm(r.requester)} y ${nm(r.spouse)}`)
    setLeader(null); setGZone(r.zones[0] ?? ''); setGTime(r.available_times[0] ?? ''); setGStart('')
  }

  async function createGroup(id: string) {
    if (!gName.trim() || !leader) { notify('Nombre y dirigente son obligatorios.', 'error'); return }
    setBusy(true)
    try {
      const res = await fetch(`/api/studies/prematrimonial/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_group', group: { name: gName.trim(), leader_id: leader.id, zone: gZone || null, schedule_time: gTime || null, starts_at: gStart || null } }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error || 'Error')
      notify('Grupo creado y pareja asignada.', 'success'); setPanel(null); load()
    } catch (e) { notify(e instanceof Error ? e.message : 'No se pudo crear el grupo.', 'error') }
    finally { setBusy(false) }
  }

  async function cancel(id: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/studies/prematrimonial/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', reason: cancelReason.trim() || null, with_refund: withRefund }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error || 'Error')
      notify(withRefund ? 'Solicitud cancelada; devolución enviada a finanzas.' : 'Solicitud cancelada.', 'success')
      setPanel(null); setCancelReason(''); load()
    } catch (e) { notify(e instanceof Error ? e.message : 'No se pudo cancelar.', 'error') }
    finally { setBusy(false) }
  }

  return (
    <div>
      <p className="mb-4 text-sm text-navy-light/70 font-body">
        Solicitudes de curso prematrimonial. Tomá una pendiente y armá el grupo con la pareja.
      </p>

      {loading && <p className="py-12 text-center text-sm text-navy-light/60 font-body">Cargando…</p>}
      {!loading && items.length === 0 && <p className="py-12 text-center text-sm text-navy-light/60 font-body">No hay solicitudes.</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {items.map(r => (
          <article key={r.id} className="rounded-2xl bg-white p-5 ring-1 ring-navy/10">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-sm font-semibold text-navy font-display inline-flex items-center gap-1.5"><Users size={15} className="text-teal-deep" /> {nm(r.requester)} <span className="text-navy-light/50">y</span> {nm(r.spouse)}</h2>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium font-body ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
            </div>

            <div className="mt-3 space-y-1.5 text-[13px] text-navy-light/80 font-body">
              {r.available_days.length > 0 && <p className="inline-flex flex-wrap items-center gap-1.5"><Calendar size={13} /> {r.available_days.join(', ')} · {r.available_times.join('/')}</p>}
              {r.zones.length > 0 && <p className="flex items-center gap-1.5"><MapPin size={13} /> {r.zones.join(', ')}</p>}
              {r.can_host && <p className="flex items-center gap-1.5"><Home size={13} /> Ofrece casa{r.host_address ? `: ${r.host_address}` : ''}{r.host_maps_url ? ` · ${r.host_maps_url}` : ''}</p>}
              {(r.ceremony_date || r.officiant) && <p className="flex items-center gap-1.5"><Clock size={13} /> Boda: {r.ceremony_date ? `${r.ceremony_date}${r.ceremony_date_defined ? '' : ' (aprox)'}` : 'sin fecha'}{r.venue_outside_gam ? ' · fuera del GAM' : ''}{r.officiant ? ` · oficia: ${r.officiant}` : ''}</p>}
              {r.comments && <p className="text-navy-light/60">“{r.comments}”</p>}
              {r.status === 'pago_en_revision' && <p className="text-amber-700">Esperando que finanzas apruebe el pago.</p>}
              {r.status === 'cancelada' && r.cancel_reason && <p className="text-navy-light/60">Motivo: {r.cancel_reason}</p>}
            </div>

            {/* PRE-8: marca de seguimiento pastoral tras el cierre. */}
            {r.needs_follow_up && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-800 font-body">
                ⚑ En seguimiento tras el cierre
                {r.follow_up_plan === 'consejeria' ? ': consejería/mentoría recomendada' : r.follow_up_plan === 'posponer' ? ': se sugirió posponer la boda' : ''}
              </p>
            )}

            {r.status === 'grupo_creado' && r.resulting_group_id && (
              <Link href={`/estudios/grupos/${r.resulting_group_id}`} className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-teal-deep font-body">Ver grupo →</Link>
            )}

            {r.status === 'pendiente' && panel?.id !== r.id && (
              <div className="mt-4 flex gap-2">
                <button onClick={() => openGroup(r)} className="inline-flex items-center gap-1.5 rounded-full bg-teal px-3.5 py-1.5 text-[13px] font-medium text-white font-body"><Check size={13} /> Crear grupo</button>
                <button onClick={() => setPanel({ id: r.id, mode: 'cancel' })} className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 px-3.5 py-1.5 text-[13px] text-navy-light/70 font-body"><X size={13} /> Cancelar</button>
              </div>
            )}

            {/* Panel crear grupo */}
            {panel?.id === r.id && panel.mode === 'group' && (
              <div className="mt-4 space-y-2 rounded-xl bg-surface-low p-3">
                <input value={gName} onChange={e => setGName(e.target.value)} placeholder="Nombre del grupo" className="w-full rounded-lg border border-navy/15 px-3 py-2 text-[13px] outline-none focus:border-navy/30 font-body" />
                <div><p className="mb-1 text-[12px] text-navy-light/60 font-body">Dirigente {leader && <span className="text-teal-deep">· {leader.first_name} {leader.last_name}</span>}</p>
                  <MemberCombobox onSelect={setLeader} placeholder="Buscar dirigente…" dropdown /></div>
                <div className="flex gap-2">
                  <input value={gZone} onChange={e => setGZone(e.target.value)} placeholder="Zona" className="flex-1 rounded-lg border border-navy/15 px-3 py-2 text-[13px] outline-none focus:border-navy/30 font-body" />
                  <input value={gTime} onChange={e => setGTime(e.target.value)} placeholder="Horario" className="flex-1 rounded-lg border border-navy/15 px-3 py-2 text-[13px] outline-none focus:border-navy/30 font-body" />
                </div>
                <input type="date" value={gStart} onChange={e => setGStart(e.target.value)} className="rounded-lg border border-navy/15 px-3 py-2 text-[13px] outline-none focus:border-navy/30 font-body" />
                <div className="flex gap-2 pt-1">
                  <button onClick={() => createGroup(r.id)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-teal px-3.5 py-1.5 text-[13px] font-medium text-white disabled:opacity-50 font-body">{busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Crear y asignar</button>
                  <button onClick={() => setPanel(null)} className="rounded-full px-3.5 py-1.5 text-[13px] text-navy-light/70 font-body">Cerrar</button>
                </div>
              </div>
            )}

            {/* Panel cancelar */}
            {panel?.id === r.id && panel.mode === 'cancel' && (
              <div className="mt-4 space-y-2 rounded-xl bg-coral/5 p-3">
                <input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Motivo de la cancelación" className="w-full rounded-lg border border-navy/15 px-3 py-2 text-[13px] outline-none focus:border-navy/30 font-body" />
                <label className="flex items-center gap-2 text-[13px] text-navy font-body"><input type="checkbox" checked={withRefund} onChange={e => setWithRefund(e.target.checked)} /> Generar solicitud de devolución (₡25.000) a finanzas</label>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => cancel(r.id)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-coral px-3.5 py-1.5 text-[13px] font-medium text-white disabled:opacity-50 font-body">{busy ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />} Confirmar cancelación</button>
                  <button onClick={() => setPanel(null)} className="rounded-full px-3.5 py-1.5 text-[13px] text-navy-light/70 font-body">Cerrar</button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
